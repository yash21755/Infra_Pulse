# Infra_Pulse — ML Pipeline Services

Three independent FastAPI microservices implementing the full ML pipeline from the paper.

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Main Backend                     │
└──────────┬───────────────────────┬──────────────────────┬────────────┘
           │                       │                      │
           ▼                       ▼                      ▼
  :8001 Geospatial        :8002 Redundancy         :8003 Priority
  Pre-Filter API          Detector API             Ranker API
  (Shapely polygons)      (CLIP + MLP)             (Log-Time Decay
                                                  + Velocity)
```

---

## Methodology & Architecture Approach

Infra_Pulse utilizes three specialized ML and algorithmic microservices designed to tackle urban and campus infrastructure reporting at scale. Our approach addresses key bottlenecks in traditional reporting systems: spatial ambiguity, duplicated reports, and static chronological feeds.

### 1. Geospatial Pre-Filtering (O(1) Search Space Reduction)
Instead of relying on computationally expensive and often inaccurate Euclidean radius searches (which fail for multi-story or adjacent buildings), we map raw GPS coordinates into strict semantic boundaries.
* **Point-in-Polygon:** We use `shapely` topological geometry against OpenStreetMap (OSM) polygons.
* **Open Area Fallbacks:** If a coordinate falls completely outside all registered buildings, it is deterministically hashed into a ~50-meter grid bucket (`ZONE_lat_lon`).
* **Why?** This reduces the vector search space for our redundancy pipeline from the entire database down to only the active issues within that specific building or 50m zone.

### 2. Multi-Modal Redundancy Detection
We prevent duplicate issue spam by semantically comparing incoming reports against active reports in the same geographic cluster.
* **CLIP Encodings:** We use OpenAI's CLIP (`ViT-B/32`) to encode both the textual description and the image of a report into a joint 512-dimensional embedding space.
* **Fusion:** Text and image embeddings are concatenated to form a 1024-dimensional representation.
* **Cosine Similarity Fallback & MLP:** Initially, duplicate checks rely on a weighted Cosine Similarity of the text and visual vectors against a localized in-memory vector store. As the platform matures and labels are collected, this is intended to be upgraded to a trained Neural Network (MLP Coupling Network) to classify pairs directly.

### 3. Dynamic Priority Ranking (Velocity + Decay)
A simple chronological feed hides critical issues, while an upvote-only feed creates stagnant echo chambers. We implemented a continuous, time-decayed ranking algorithm.
* **Log-Time Decay:** Base scores decay logarithmically over a configured half-life to gradually deprecate old issues.
* **Engagement Velocity:** Upvotes and *dwell time* (active reading time) dynamically boost an issue's score. The system tracks "velocity" (votes per 5-minute window) to identify rapidly trending emergencies.
* **Diversity Rules:** Penalizes long streaks of identical categories to ensure varied visibility.

---

## Data Flow & Workflows

**1. Issue Submission Workflow**
* **Client** sends GPS coordinates, description, and an optional image.
* **Node.js** forwards GPS to **Geospatial API** → gets a `building_id` or `ZONE` ID.
* **Node.js** forwards image/text + `building_id` to **Redundancy API**.
  * *If redundant:* Submission is halted; user is redirected to the existing issue.
  * *If novel:* **Node.js** saves to MongoDB/PostgreSQL.
* **Node.js** asynchronously registers the novel issue's embeddings with the **Redundancy API** and initializes its rank in the **Priority API**.

**2. Engagement Workflow**
* Users view issues (triggering dwell-time metrics) and cast upvotes.
* **Node.js** forwards these interactions to the **Priority API**.
* **Priority API** updates internal velocity tracking and recalculates the continuous score.
* When the Client requests the feed, the **Priority API** provides a dynamically sorted list.

**3. Resolution Workflow**
* Admin or authoritative user marks an issue as resolved.
* **Node.js** instructs the **Redundancy API** to drop the vector (preventing it from matching future issues).
* **Node.js** instructs the **Priority API** to mark the issue resolved, removing it from the active ranked feed.

---

## Quick Start

```bash
cd infrapulse/
pip install -r requirements.txt

# Terminal 1 — Geospatial (no GPU needed, starts instantly)
python geospatial_api.py

# Terminal 2 — Redundancy (downloads CLIP ~600 MB on first run)
python redundancy_api.py

# Terminal 3 — Priority
python priority_api.py
```

---

## Environment Variables (all optional)

| Variable | Default | Description |
|---|---|---|
| `CAMPUS_BUILDINGS_CONFIG` | `buildings.json` | Path to building polygons config |
| `REDUNDANCY_THRESHOLD` | `0.85` | Cosine similarity threshold for duplicates |
| `CLIP_MODEL_NAME` | `openai/clip-vit-base-patch32` | HuggingFace CLIP model |
| `VISUAL_WEIGHT` | `0.40` | Image weight in cosine fallback |
| `TEXT_WEIGHT` | `0.60` | Text weight in cosine fallback |
| `DECAY_CONSTANT` | `45000` | Half-life constant (seconds) |
| `VELOCITY_WINDOW_SECONDS` | `300` | Velocity tracking window |
| `DIVERSITY_STREAK_LIMIT` | `3` | Anti-stagnation streak threshold |
| `DWELL_TIME_MIN_SECONDS` | `3.0` | Minimum dwell to count as valid vote |
| `GEOSPATIAL_PORT` | `8001` | |
| `REDUNDANCY_PORT` | `8002` | |
| `PRIORITY_PORT` | `8003` | |

---

## Integration Flow (Node.js example)

```javascript
// When a new issue is submitted:

// Step 1 — Resolve building
const geoRes = await fetch('http://localhost:8001/resolve-location', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: req.body.lat, longitude: req.body.lon })
});
const { building_id } = await geoRes.json();

// Step 2 — Check for duplicates
const form = new FormData();
form.append('building_id', building_id);
form.append('text', req.body.description);
if (req.file) form.append('image', req.file.buffer, 'image.jpg');

const redRes = await fetch('http://localhost:8002/check-redundancy', {
  method: 'POST', body: form
});
const { is_redundant, top_match_id } = await redRes.json();

if (is_redundant) {
  // Redirect user to existing issue
  return res.json({ duplicate: true, existing_issue_id: top_match_id });
}

// Step 3 — Save to your database
const newIssue = await db.issues.create({ ...req.body, building_id });

// Step 4 — Register embedding
const regForm = new FormData();
regForm.append('issue_id', newIssue.id);
regForm.append('building_id', building_id);
regForm.append('text', req.body.description);
await fetch('http://localhost:8002/register-issue', { method: 'POST', body: regForm });

// Step 5 — Register in priority ranker
await fetch('http://localhost:8003/issues', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    issue_id:      newIssue.id,
    category:      req.body.category,
    sub_community: building_id,
    building_id:   building_id,
  })
});

return res.json({ success: true, issue_id: newIssue.id });
```

```javascript
// When a user upvotes:
await fetch('http://localhost:8003/vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    issue_id:      issueId,
    vote_type:     'upvote',
    dwell_seconds: dwellTimeTrackedOnFrontend,  // send from client
  })
});
```

```javascript
// Get ranked front page
const feed = await fetch('http://localhost:8003/front-page?limit=20&building_id=HOSTEL-1');
const { issues } = await feed.json();
```

---

## Training the Coupling Network (Optional — improves accuracy)

When you have enough resolved issues, you can train the MLP coupling network
to replace the cosine similarity fallback:

```python
# train_coupling_network.py  (run separately after collecting data)
import torch, torch.nn as nn
from redundancy_api import CouplingNetwork

# Load your labelled pairs: (fused_embedding, is_duplicate_label)
# pairs = [(np.array(1024,), int), ...]

model = CouplingNetwork(input_dim=1024)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
criterion = nn.BCELoss()

for epoch in range(50):
    for fused_vec, label in pairs:
        x = torch.tensor(fused_vec).unsqueeze(0)
        y = torch.tensor([[float(label)]])
        pred = model(x)
        loss = criterion(pred, y)
        optimizer.zero_grad(); loss.backward(); optimizer.step()

torch.save(model.state_dict(), 'models/coupling_network.pt')
# Restart redundancy_api.py — it will auto-load the weights
```

---

## API Reference

### Geospatial API  (:8001)
| Method | Path | Description |
|---|---|---|
| `POST` | `/resolve-location` | GPS → building_id |
| `POST` | `/resolve-location/batch` | Batch GPS resolution |
| `GET` | `/buildings` | List all buildings |
| `GET` | `/buildings/{id}` | Get building details |

### Redundancy API  (:8002)
| Method | Path | Description |
|---|---|---|
| `POST` | `/check-redundancy` | Check if issue is duplicate |
| `POST` | `/register-issue` | Add confirmed issue to vector store |
| `DELETE` | `/issues/{id}` | Remove issue embedding |
| `GET` | `/stats` | Vector store statistics |
| `GET` | `/threshold` | Current threshold config |

### Priority API  (:8003)
| Method | Path | Description |
|---|---|---|
| `POST` | `/issues` | Register new issue |
| `POST` | `/vote` | Process vote event |
| `POST` | `/dwell` | Record reading time |
| `GET` | `/front-page` | Get ranked feed |
| `GET` | `/issues/{id}/score` | Get score breakdown |
| `PATCH` | `/issues/{id}/resolve` | Mark resolved |
| `DELETE` | `/issues/{id}` | Remove issue |
| `GET` | `/stats` | Priority store statistics |