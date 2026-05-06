import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { uploadFiles, listFiles, deleteMediaFile, getFileUrl } from "../controllers/mediaController";
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500*1024*1024, files: 20 } });
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ success: false, message: err.message });
  next(err);
};
router.use(authenticate);
router.post("/:itemId/files", upload.array("files", 20), handleMulterError, uploadFiles);
router.get("/:itemId/files", listFiles);
router.get("/:itemId/files/:fileId/url", getFileUrl);
router.delete("/:itemId/files/:fileId", deleteMediaFile);
export default router;