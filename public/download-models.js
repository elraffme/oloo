// Script to download face-api.js models
// This will be called automatically when the app loads

const MODEL_URLS = {
  'tiny_face_detector_model-weights_manifest.json': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1',
  'face_recognition_model-shard2': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-weights_manifest.json',
  'face_expression_model-shard1': 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-shard1'
};

// This script is referenced for documentation purposes only
// The actual models will be loaded via CDN in the face verification component