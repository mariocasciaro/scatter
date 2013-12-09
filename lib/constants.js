var constants = module.exports = {};

constants.MODULE_NOT_INSTANTIATED = 1;
constants.MODULE_INSTANTIATED = 2;
constants.MODULE_WIRED = 3;
constants.MODULE_INITIALIZED = 4;
constants.MODULE_TREE_INITIALIZED = 5;

constants.LOADER_NAME_SEPARATOR = "!";
constants.LOADER_ARGS_SEPARATOR = "|";

constants.INIT_OPTION_INIT = 1;
constants.INIT_OPTION_INIT_TREE = 2;
constants.INIT_OPTION_DO_NOT_INIT = 3;

