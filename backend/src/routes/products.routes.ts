import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  productIdParamSchema,
  semanticSearchSchema,
} from '../validators/products.validator';
import * as productsService from '../services/products.service';
import * as semanticSearchService from '../services/semanticSearch.service';

const router = Router();

router.get(
  '/',
  validate({ query: productFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productsService.listProducts({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
        supplier_id: req.query.supplier_id as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/semantic-search',
  validate({ body: semanticSearchSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await semanticSearchService.semanticSearch(req.body.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  validate({ params: productIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.id as string, 10);
      const product = await productsService.getProduct(productId);
      res.json(product);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate({ body: createProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productsService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.id as string, 10);
      const product = await productsService.updateProduct(productId, req.body);
      res.json(product);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
