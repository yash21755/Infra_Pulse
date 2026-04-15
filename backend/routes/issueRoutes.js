const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
  voteIssue
} = require('../controllers/issueController');
const { getUpdates, postUpdate } = require('../controllers/updateController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.get('/', getIssues);
router.post('/', auth, upload.single('image'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
], validate, createIssue);
router.get('/:id', getIssue);
router.put('/:id', auth, updateIssue);
router.delete('/:id', auth, deleteIssue);
router.post('/:id/vote', auth, voteIssue);

// Authority updates (replaces comments)
router.get('/:id/updates', getUpdates);
router.post('/:id/updates', auth, upload.single('image'), [
  body('message').notEmpty().withMessage('Message is required'),
  body('tag').isIn(['work_in_progress', 'finished']).withMessage('Tag must be work_in_progress or finished'),
], validate, postUpdate);

module.exports = router;
