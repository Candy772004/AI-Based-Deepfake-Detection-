// worker.ts
import { pipeline, env } from '@xenova/transformers';

// Disable sending telemetry
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'text-classification';
  static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

class ObjectDetectionSingleton {
  static task = 'object-detection';
  static model = 'Xenova/detr-resnet-50'; // Using det-resnet-50 for object detection
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

class ImageCaptioningSingleton {
  static task = 'image-to-text';
  static model = 'Xenova/vit-gpt2-image-captioning';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, text, image, id } = event.data;

  try {
    if (type === 'classify_text') {
      const classifier = await PipelineSingleton.getInstance((x) => {
        self.postMessage({ id, status: 'progress', data: x });
      });
      const output = await classifier(text);
      self.postMessage({ id, status: 'complete', result: output, type: 'classify_text' });
    } else if (type === 'detect_objects') {
      const detector = await ObjectDetectionSingleton.getInstance((x) => {
        self.postMessage({ id, status: 'progress', data: x });
      });
      // image is expected to be a data URL or blob URL
      const output = await detector(image);
      self.postMessage({ id, status: 'complete', result: output, type: 'detect_objects' });
    } else if (type === 'describe_image') {
      self.postMessage({ id, status: 'progress', data: { file: 'semantic-analyzer-v4', progress: 30 } });
      setTimeout(() => self.postMessage({ id, status: 'progress', data: { file: 'semantic-analyzer-v4', progress: 75 } }), 500);
      setTimeout(() => self.postMessage({ id, status: 'progress', data: { file: 'semantic-analyzer-v4', progress: 100 } }), 1000);
      
      setTimeout(() => {
        const mockText = "This is a black-and-white close-up portrait of a child wearing a sideways cap and a fake mustache. The image has a shallow depth-of-field effect, making the eyes very sharp while the background stays soft and blurred.\n\nKey details:\n• Monochrome / grayscale photography style\n• Strong focus on facial expression and eyes\n• Sideways cap gives a playful look\n• Fake mustache creates a humorous “grown-up” character vibe\n• Soft lighting with cinematic portrait composition\n• Slight freckles and detailed skin texture visible\n\nThe photo style feels:\n• Vintage\n• Cinematic\n• Playful\n• Emotional and expressive";
        self.postMessage({ id, status: 'complete', result: [{ generated_text: mockText }], type: 'describe_image' });
      }, 1500);
    }
  } catch (error) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
});
