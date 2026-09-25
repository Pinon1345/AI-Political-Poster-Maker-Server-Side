import { Schema, model, Document, Types } from 'mongoose';

export interface IPoster extends Document {
  userId: Types.ObjectId;
  templateId: Types.ObjectId;
  formData: {
    name: string;
    designation: string;
    party: string;
    district: string;
    headline: string;
  };
  uploadedPhotoUrls: string[];
  generatedImageUrl?: string;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
}

const posterSchema = new Schema<IPoster>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
  formData: {
    name: { type: String, required: true },
    designation: { type: String, required: true },
    party: { type: String, required: true },
    district: { type: String, required: true },
    headline: { type: String, required: true },
  },
  uploadedPhotoUrls: [{ type: String }],
  generatedImageUrl: { type: String },
  status: { type: String, enum: ['draft', 'generating', 'completed', 'failed'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
});

export const Poster = model<IPoster>('Poster', posterSchema);