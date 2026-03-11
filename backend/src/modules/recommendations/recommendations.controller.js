const createModuleStub = require('../../shared/module-stub');

const contextualRecommendation = createModuleStub(
  'Contextual recommendation',
  'AI or backend member'
);

const imageRecognition = createModuleStub('Image recognition', 'AI member');
const chatRecommendation = createModuleStub('AI chat recommendation', 'AI or backend member');

module.exports = {
  contextualRecommendation,
  imageRecognition,
  chatRecommendation
};