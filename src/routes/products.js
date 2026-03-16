const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateStock,
} = require('../controllers/productController');

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.patch('/:id/stock', authenticate, updateStock);

module.exports = router;
