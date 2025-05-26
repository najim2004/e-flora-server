import { Request, Response } from "express";

export class DiseaseDetectionController {
  //   constructor() {}
  public static detectDisease(req: Request, res: Response): void {
    // Placeholder for disease detection logic
    res.status(200).json({
      message: 'Disease detection request received',
      success: true,
    });
  }
}
