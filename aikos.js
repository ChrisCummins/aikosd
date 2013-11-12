/*
 * shit.js - The main shit daemon. Manages the filesystem watchers and
 *           sockets.io clients and sessions.
 *
 * Available exports:
 *     () The Shit class.
 *
 * Usage:
 *     var Shit = require('./shit');
 *
 *     var shit = new Shit(); // Instantiate class
 *
 * Config settings:
 */

/* Local imports */
var config = require('./config');
var ctx = require('./ctx');
var FileWatcher = require('./filewatcher');
var util = require('./util');

/*
 * The Shit class.
 *
 * @param server An http server.
 */
var Shit = function(server) {

  /* Sockets */
  var io = require('socket.io').listen(server);
  var socket = io.sockets;

  /* The server sessions and clients */
  var sessions = [];
  var clients = {};

  /* The server state */
  var messages = [];

  /* The filewatcher nodes */
  var filewatchers = [];

  /*
   * Broadcast a message
   *
   * @param sessions
   * @param command
   * @param data
   * @param exception
   */
  function broadcast(sessions, command, data, exception) {
    for (var i=0; i < sessions.length; i++) {
      if (!exception || sessions[i] != exception)
	clients[sessions[i]].emit(command, data);
    };
  };

  /*
   * Push all messages to sessions.
   */
  function pushAllMessages() {
    broadcast(sessions, 'messages', messages);
  }

  /*
   * Push a new message to sessions.
   *
   * Schema:
   *
   *  type: (int)  -1 error
   *                0 create
   *                1 update
   *                2 delete
   */
  function pushNewMessage(type, path, msg) {
    var msg = {
      timestamp: new Date().getTime(),
      type: parseInt(type),
      message: msg,
      path: path
    };

    messages.push(msg);
    broadcast(sessions, 'newMessage', msg);
  };

  /*
   * Our socket connection.
   */
  socket.on('connection', function(client) {

    client.on('disconnect', function() {
      for (var i = 0; i < sessions.length; i++) {
	if (sessions[i] == client.id) {
	  delete clients[client.id];
	  sessions.splice(i,1);
	  break;
	}
      };
    });

    client.on('join', function (data) {
      util.add(sessions, client.id);
      clients[client.id] = client;

      pushAllMessages();
    });

  });

  function errorListener(error) {
    pushNewMessage(-1, '', JSON.stringify(error));
  };

  function watchingListener(error, watcherInstance, isWatching) {
    if (error) {
      console.log("watching the path " + watcherInstance.path + " failed with error", error);
    } else {
      console.log("watching the path " + watcherInstance.path + " completed");
    }
  };

  function updateListener(filePath, currentStat, previousStat) {
    pushNewMessage(1, filePath, JSON.stringify(currentStat));
  };

  function createListener(filePath, currentStat, previousStat) {
    pushNewMessage(0, filePath, JSON.stringify(currentStat));
  };

  function deleteListener(filePath, previousStat) {
    pushNewMessage(2, filePath, JSON.stringify(previousStat));
  };

  function changeListener(changeType, filePath,
                          currentStat, previousStat) {
    switch (changeType) {
    case 'update':
      updateListener(filePath, currentStat, previousStat);
      break;
    case 'create':
      createListener(filePath, currentStat, previousStat);
      break;
    case 'delete':
      deleteListener(filePath, previousStat);
      break;
    default:
      console.log('Unhandled changeType: ' + changeType);
      break;
    }
  };

  /*
   * Initial setup.
   */
  function init() {

    function createFileWatchers() {
      for (var f in config.shit.files) {
        filewatchers.push(new FileWatcher(f, config.shit.files[f],
                                          errorListener,
                                          watchingListener, changeListener));
      }
    };

    createFileWatchers();
  }

  /*
   * Cleanup close.
   */
  function close() {

    function closeFileWatchers() {
      console.log('\nShutting down filewatchers.');
      for (var i = 0; i < filewatchers.length; i++)
        filewatchers[i].close();
    };

    closeFileWatchers();
  }

  init();

  /* Close on exit */
  process.on('SIGINT', function() {
    close();
  });
};

module.exports = Shit;
