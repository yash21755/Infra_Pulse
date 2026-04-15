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

module.exports = router;
