import requests
import concurrent.futures

def cast_votes(issue_id, num_votes):
    url = "http://localhost:8003/vote"
    payload = {
        "issue_id": issue_id,
        "vote_type": "upvote",
        "dwell_seconds": 5.0
    }
    
    def send_req(_):
        try:
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            pass
            
    print(f"Casting {num_votes} upvotes for {issue_id}...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        executor.map(send_req, range(num_votes))
    print(f"Finished casting {num_votes} upvotes for {issue_id}.")

if __name__ == "__main__":
    # oldest
    cast_votes("69f8f4715420071f661dab4d", 200)
    
    # middle
    cast_votes("69f8f8a65420071f661dabc3", 4000)
    
    # newest
    cast_votes("69f8fa555420071f661dabc9", 7)
