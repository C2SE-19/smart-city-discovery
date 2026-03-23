function createModuleStub(moduleName, recommendedOwner) {
  return function moduleStubHandler(req, res) {
    res.status(501).json({
      message: `${moduleName} is scaffolded but not implemented yet.`,
      recommendedOwner,
      nextStep: 'Replace this stub controller with real business logic for the assigned team member.'
    });
  };
}

module.exports = createModuleStub;