var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var exec = require('child_process').exec;
var config = require('./config').shit;

var FileCache = function(srcpath) {

  this.path = srcpath;
  this.uid = getCacheUID();
  this.cache = config.cache + this.uid + '/';

  if (!fs.lstatSync(this.path).isDirectory())
    this.cache += path.basename(srcpath);

  this.push = function() {
    var cmd = 'rsync -a ' + this.path + ' ' + this.cache;

    console.log(this.cache + ': push!');

    exec(cmd);
  };

  this.pull = function() {
    var cmd = 'rsync -a ' + this.cache + ' ' + this.path;

    console.log(this.cache + ': pull!');

    exec(cmd);
  };

  console.log('creating file cache \'' + this.cache + '\'');

  mkdirp(path.dirname(this.cache), function(err) {
    if (err)
      console.log(err);
  });

  this.push();

  this.close = function() {
    var cmd = 'rm -rf ' + this.cache;

    console.log('closing file cache \'' + this.cache + '\'');

    exec(cmd);
  };

  function getCacheUID() {
    function generateUID() {
      return Math.floor((Math.random() * 9000) + 1000);
    }

    return generateUID();
  }

}

module.exports = FileCache;
