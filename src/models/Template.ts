import { Schema, model, Document } from 'mongoose';

export interface ITemplate extends Document {
  title: string;
  occasionType: string;
  thumbnailUrl: string;
  layoutConfig: object;
  isActive: boolean;
}

const templateSchema = new Schema<ITemplate>({
  title: { type: String, required: true },
  occasionType: { type: String, required: true }, // e.g., 'bijoy-dibosh', 'election', 'shok'
  thumbnailUrl: { type: String, required: true },
  layoutConfig: { type: Object, required: true },
  isActive: { type: Boolean, default: true },
});

export const Template = model<ITemplate>('Template', templateSchema);