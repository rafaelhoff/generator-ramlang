'use strict';
var http        = require('http');
var https       = require('https');
var util        = require('util');
var path        = require('path');
var yeoman      = require('yeoman-generator');
var chalk       = require('chalk');
var ramlParser  = require('raml-parser');
var fs          = require('fs');
var inflect     = require('inflection');

var utils       = require('./utils');
var ramlUtils   = require('../lib/utils');
var application = require('../lib/app');
var provider    = require('../lib/provider');
var service     = require('../lib/service');

var pathRegex = /[\|&;\$%@"<>\(\)\+,]/g;

var Generator = module.exports = function Generator() {
  yeoman.generators.Base.apply(this, arguments);

  // Register options
  this.option('save', {
    desc: 'Stores all answers to a file.',
    required: false,
    type: "String"
  });

  this.option('file', {
    desc: 'Reads an specific configuration file.',
    required: false,
    type: "String"
  });

  this.option('clean', {
    desc: 'Indicates that you want to ignore any saved answers.',
    required: false
  });

  this.option('force', {
    desc: 'Suppresses prompting when saving files.',
    required: false
  });

  this.option('welcome-off', {
    desc: 'Doesn\'t display the welcome message.',
    required: false
  });

  /**
   * Gets the list of raml files in the current working directory.
   */
  var filePath = path.resolve('.'); // current working directory.

  this.ramlFiles = (fs.readdirSync(filePath) || []).filter(function(item) {
    return path.extname(item).endsWith('.raml');
  });

  this.ramlFiles.push('Custom');
};

util.inherits(Generator, yeoman.generators.Base);

/**
 * Loads the config file if there is one.
 */
Generator.prototype.config = function() {
  if (this.options.save && this.options.file) {
    console.log("--save and --file cannot be provided at the same time.");
    process.exit(1);
  }
  // Initialise the yeoman config for this generator
  this.config.path = (this.options.save && typeof this.options.save === "string") ? this.options.save : 
                     (this.options.file && typeof this.options.file === "string") ? this.options.file : './.ramlang';
  this.config.loadConfig();

  // load up any saved configurations if the user hasn't provided the 'clean' argument
  if (this.config.existed && !this.options.clean) {
    this.apiModuleName      = this.config.get('apiModuleName');
    this.ramlFilename       = this.config.get('ramlPath');
    this.selectedResources  = this.config.get('selectedResources');
    this.generateInOneFile  = this.config.get('allInOneFile');
    this.filesDist          = this.config.get('destination');
    this.options.force      = this.config.get('force');
    this.mediaTypeExtension = this.config.get('mediaTypeExtension');
  }
  else {
    if (this.options.file) {
      console.log("Configuration file: "+this.options.file+" not found.");
    }
  }
};
/**
 * Prints the welcome message.
 */
Generator.prototype.welcome = function() {

  // Don't display the welcome message if the option is provided.
  if (this.options['welcome-off'] === true) { return; }

  var ramlang ='\n' +
      chalk.cyan('██████╗   █████╗  ███╗   ███╗ ██╗      ')+chalk.red(' █████╗  ███╗   ██╗  ██████╗  \n') +
      chalk.cyan('██╔══██╗ ██╔══██╗ ████╗ ████║ ██║      ')+chalk.red('██╔══██╗ ████╗  ██║ ██╔════╝  \n') +
      chalk.cyan('██████╔╝ ███████║ ██╔████╔██║ ██║      ')+chalk.red('███████║ ██╔██╗ ██║ ██║  ███╗ \n') +
      chalk.cyan('██╔══██╗ ██╔══██║ ██║╚██╔╝██║ ██║      ')+chalk.red('██╔══██║ ██║╚██╗██║ ██║   ██║ \n') +
      chalk.cyan('██║  ██║ ██║  ██║ ██║ ╚═╝ ██║ ███████╗ ')+chalk.red('██║  ██║ ██║ ╚████║ ╚██████╔╝ \n') +
      chalk.cyan('╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚══════╝ ')+chalk.red('╚═╝  ╚═╝ ╚═╝  ╚═══╝  ╚═════╝  \n');

  this.log(ramlang);

  this.log('Welcome to RAMLang!!!\n');
};

/**
 * Prompts the user a series of questions to determine what the generator needs to do.
 */
Generator.prototype.initialQuestions = function () {

  var done = this.async();
  var self = this;
  var prompts = [];
  var prompt1 = {
    type: 'input',
    name: 'apiModuleName',
    message: 'What would you like to call the module',
    validate: function(input) {
      return input && input.replace(pathRegex, '').trim().length > 0;
    }
  };
  var prompt2 = {
    type: 'list',
    name: 'ramlFilename',
    message: 'Which RAML file would you like to use',
    choices: this.ramlFiles
  };
  var prompt3 = {
    type: 'input',
    name: 'ramlFilename',
    message: 'I need the path to your RAML file. This can be a url (http|https): ',
    validate: function(input) {
      var filePath = path.resolve(input);
      return path.extname(filePath).indexOf('.raml') > -1;
    },
    when: function(answer) {
      return answer.ramlFilename == 'Custom' || self.ramlFiles.length == 1;
    }
  };

  if (this.ramlFiles.length == 2) {
    // There is only one file so just default it.
    this.ramlFilename = this.ramlFiles[0];
  }

  if (this.ramlFiles.length > 2) {
    prompts = [prompt1, prompt2, prompt3];
  } else {
    delete prompt2.when;
    prompts = [prompt1, prompt3];
  }

  if (this.ramlFilename) {
    prompts = [prompt1];
  }

  if (this.apiModuleName) {
    prompts.shift(); // remove the first prompt
  }

  if (prompts.length > 0) {
    this.prompt(prompts, function (props) {
      this.ramlFilename = props.ramlFilename || this.ramlFilename;
      this.apiModuleName = props.apiModuleName.replace(pathRegex, '');


      console.log('\nAngular application module name:', this.apiModuleName);
      console.log('Chosen RAML file: ', this.ramlFilename, '\n');

      done();
    }.bind(this));
  } else {
    done();
  }  
};

/**
 * Reads the specified raml file provided by the users input from the previous questions.
 * If the file path is a url then we download the file into the current working directory
 * before parsing the raml from it.
 */
Generator.prototype.readRamlFile = function() {
  // Return if there is no file to read
  if (!this.ramlFilename) {
    this.log('No RAML file path provided.');
    return;
  }

  this.ramlFilename = this.ramlFilename.trim();

  var done = this.async();
  var self = this;
  var isHttp = this.ramlFilename.indexOf('http://') === 0;
  var isHttps = this.ramlFilename.indexOf('https://') === 0;
  var isUri = isHttp || isHttps;
  console.log(chalk.blue('Reading RAML file'));

  var progressInterval;

  var endFn = function() {

    if (self.ramlSpecObj) {
      ramlUtils.formatResourceDisplayName(self.ramlSpecObj);

      if (self.selectedResources) {
        self.ramlSpecObj.resources = utils.filterResources(self.selectedResources, self.ramlSpecObj.resources);
        self.selectedResourceObjs = self.ramlSpecObj.resources;
      }
    }

    if (progressInterval) {
      clearInterval(progressInterval);
    }

    done();
  };

  var loadRaml = function() {
    ramlParser.loadFile(self.ramlFilename)
      .then(function(data) {
        console.log(chalk.green(' ✔\n'));
        self.log(); // add new line
        self.ramlSpecObj = data;
      })
      .catch(function(error) {
        self.log();
        self.log();
        self.log(chalk.red('RAML Parser failed: \n' + error));
        self.log();
      })
      .finally(endFn);
  };

  if (isUri) {
    var requester = isHttp ? http : https;

    // Remove
    var saveFilePath = this.ramlFilename;
    var index = this.ramlFilename.indexOf('?');
    if (index > -1) {
      saveFilePath = this.ramlFilename.substring(0, index);
    }

    if (path.extname(saveFilePath).indexOf('.raml') < 0) {
      saveFilePath += '.raml';
    }

    saveFilePath = path.basename(saveFilePath);

    progressInterval = setInterval(function() {
      console.log('.');
    }, 100);

    var file = fs.createWriteStream(saveFilePath);
    requester.get(this.ramlFilename, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(function() {
          self.ramlFilename = saveFilePath;
          loadRaml();
        });
      });
    }, function(error) {
      self.log('');
      self.log(chalk.red('Failed to download RAML file: ' + error));

      file.close(endFn);
    });
  } else {
    loadRaml();
  }
};

/**
 * Asks the user a final set of questions before processing his or her request.
 */
Generator.prototype.finalQuestions = function() {

  // Return if there are no resources to process
  if (!this.ramlSpecObj.resources) {
    this.log('No resources loaded from RAML spec.');
    return;
  }

  var done = this.async();
  var prompts = [];

  // Map all of the resource display names
  this.allResourceDisplayNames = this.ramlSpecObj.resources.map(function(item) {
    return ramlUtils.cleanDisplayName(item.displayName, true);
  });

  var filesDist = this.filesDist || utils.getDistPath();
  var message = 'This is where i\'m going to generate the files: \n\n' + filesDist + '\n\n Is this correct';
  if (filesDist === '' || filesDist == '.') {
    message = 'Generate all files in the current directory';
  }

  if (this.ramlFiles.length > 0) {
    var prompt1 = {
      type: 'confirm',
      name: 'shouldGenAllResources',
      message: 'Would you like to generate all resources',
      default: true
    };

    var prompt2 = {
      type: 'checkbox',
      name: 'resourcesToGenerate',
      message: 'Select which resources you want to generate:',
      choices: this.allResourceDisplayNames,
      when: function(response) {
        return !response.shouldGenAllResources;
      }
    };

    var prompt3 = {
      type: 'confirm',
      name: 'allInOneFile',
      message: 'Should I generate all the resources in one file',
      default: true
    };

    var prompt4 = {
      type: 'confirm',
      name: 'filesDistCorrect',
      message: message,
      default: true
    };

    var prompt5 = {
      type: 'input',
      name: 'filesDist',
      message: 'Supply the correct path:',
      choices: this.allResourceDisplayNames,
      when: function(response) {
        return !response.filesDistCorrect || (!filesDist || filesDist.trim() === '');
      }
    };

    var prompt6 = {
      type: 'list',
      name: 'mediaTypeExtension',
      message: 'Select which media type extension to use:',
      choices: ['json', 'xml']
    };

    if (!this.mediaTypeExtension) {
      prompts.push(prompt6);
    }

    if (!this.selectedResources) {
      prompts.push(prompt1);
      prompts.push(prompt2);
    }

    if (!this.generateInOneFile) {
      prompts.push(prompt3);
    }

    if (!this.filesDist) {
      prompts.push(prompt4);
      prompts.push(prompt5);
    }
  } else {
    this.log(chalk.red('There needs to be at least one \'.raml\' file in the current working directory.'));
  }

  if (prompts.length > 0) {
    this.prompt(prompts, function (props) {
      // Update data only for the ones that had prompts.

      if (!this.selectedResources)
        this.selectedResources = props.resourcesToGenerate || this.allResourceDisplayNames;
      
      if (!this.generateInOneFile)
        this.generateInOneFile = props.allInOneFile;
      
      if (!this.filesDist)
        this.filesDist = (props.filesDist || filesDist).trim();

      this.ramlSpecObj.resources = utils.filterResources(this.selectedResources, this.ramlSpecObj.resources);
      this.selectedResourceObjs = this.ramlSpecObj.resources;
      
      if (!this.mediaTypeExtension)
        this.mediaTypeExtension = '.' + props.mediaTypeExtension;

      done();
    }.bind(this));
  } else {
    done();
  }
};

/**
 * Generates the angular javascript file(s) based on the users answers.
 */
Generator.prototype.generate = function() {
  // Return if there are no resources to process
  if (!this.selectedResourceObjs) {
    this.log('No resources to generate');
    return;
  }
  // Return if the user didn't provide a destination path
  if (!this.filesDist) {
    this.log('No destination path provided');
    return;
  }

  this.log('\nGenerating resource' + (this.selectedResourceObjs.length != 1 ? 's' : ''));

  this.conflicter.force = this.options.force;

  var fileContents = '(function () {\n  \'use strict\';\n\n';
  var moduleName = this.apiModuleName + (this.apiModuleName != 'api' ? '-api' : '');

  /**
   * A helper function to direct the resolved template text into a file or append it to a variable.
   * @param {String} resourceName - The name of the resource to use.
   * @param {String} templateText - The template text value to resolve.
   */
  this.writeTemplateToDest = function(resourceName, templateText) {

    if (this.generateInOneFile) {
      fileContents += templateText;
    } else {
      resourceName = inflect.transform(resourceName, ['underscore', 'dasherize']);
      templateText = fileContents + templateText;
      this.write(path.join(this.filesDist, resourceName + '.js'), templateText + ';');
    }
  };

  var appTemplateText = application.generate(moduleName, this.ramlSpecObj);
  var providerTemplateText = provider.generate(this.apiModuleName, this.ramlSpecObj, !this.generateInOneFile);

  this.writeTemplateToDest(moduleName, appTemplateText);
  this.writeTemplateToDest('api-provider', providerTemplateText);

  this.selectedResourceObjs.forEach(function(resource) {
    var serviceTemplateText = service.generate(this.apiModuleName, resource, !this.generateInOneFile, this.mediaTypeExtension);
    this.writeTemplateToDest(resource.displayName, serviceTemplateText);
  }, this);

  if (this.generateInOneFile) {
    fileContents += ';\n}());';
    this.write(path.join(this.filesDist, moduleName + '.js'), fileContents);
  }

  // Clean up
  fileContents = null;
};

/**
 * Finally, if the user supplied the argument 'save' then save the users selections to a .ramlang file.
 */
Generator.prototype.end = function() {

  if (this.options.save) {

    this.config.set('apiModuleName', this.apiModuleName);
    this.config.set('ramlPath', this.ramlFilename);
    this.config.set('selectedResources', this.selectedResources);
    this.config.set('allInOneFile', this.generateInOneFile);
    this.config.set('destination', this.filesDist);
    this.config.set('force', this.options.force);
    this.config.set('mediaTypeExtension', this.mediaTypeExtension);

    this.config.forceSave();
  }
};