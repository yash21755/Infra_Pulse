const express = require('express');
const { body } = require('express-validator');
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

router.get('/', getIssues);
router.post('/', auth, [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
], validate, createIssue);
router.get('/:id', getIssue);
router.put('/:id', auth, updateIssue);
router.delete('/:id', auth, deleteIssue);
router.post('/:id/vote', auth, voteIssue);

module.exports = router;
