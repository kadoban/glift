/**
 * A ServerGame encapsulates the idea of viewing/editing a game
 * on a go server.
 *
 * @type {!glift.controllers.ControllerFunc}
 */
glift.controllers.serverGame = function(sgfOptions) {
  var ctrl = glift.controllers;
  var baseController = glift.util.beget(ctrl.base());
  var newController = glift.util.setMethods(baseController,
      ctrl.ServerGameMethods);
  newController.initOptions(sgfOptions);
  newController.serverState = undefined; /* movetree for when we're
                                            "viewing offline" in KGS terms */
  return newController;
};

glift.controllers.ServerGameMethods = {
  /**
   * Called during initOptions, in the BaseController.
   *
   * This creates a treepath (a persisted treepath) and an index into the
   * treepath.  This allows us to 'remember' the last variation taken by the
   * player, which seems to be the standard behavior.
   */
  extraOptions: function() {},

  /**
   * Add a played stone to the board
   *
   * Returns null if the addStone operation isn't possible.
   */
  addStone: function(point, color, opt_server) {
    if (!opt_server && this.isOnline()) {
      this.goOffline();
    }

    if (!!opt_server == this.isOnline()) {
      // TODO(kashomon): Use the addResult
      var addResult = this.goban.addStone(point, color);
    }

    var mt = this.movetree;
    if (opt_server) {
      mt = this.getServerMoveTree();
    }

    mt.addNode();
    mt.properties().add(
        glift.sgf.colorToToken(color),
        point.toSgfCoord());
    return this.flattenedState();
  },

  /**
   * Disconnect the local state from the server state, so the user can
   * move around and edit independently.
   */
  goOffline: function() {
    this.serverState = this.serverState || this.movetree.newTreeRef();
    return this.flattenedState();
  },

  /**
   * Are we offline?
   */
  isOffline: function() {
    return !!this.serverState;
  },

  isOnline: function() {
    return !this.isOffline();
  },

  /**
   * Switch back to online state, follow what the server is doing.
   */
  goOnline: function() {
    this.movetree = this.serverState || this.movetree;
    this.serverState = undefined;
    var mtInfo = glift.rules.goban.getFromMoveTree(this.movetree);
    this.goban = mtInfo.goban;
    this.captureHistory = mtInfo.captures;
    this.clearHistory = mtInfo.clearHistory;
    return this.flattenedState();
  },

  getServerMoveTree: function() {
    return this.serverState || this.movetree;
  },

  /**
   * Go back to the previous branch or comment.
   *
   * If maxMovesPrevious is defined, then we cap the number of moves at
   * maxMovesPrevious. Otherwise, we keep going until we hit the beginning of
   * the game.
   *
   * Returns null in the case that we're at the root already.
   */
  previousCommentOrBranch: function(maxMovesPrevious) {
    var displayDataList = []; // TODO(kashomon): Merge this together?
    var displayData = null;
    var movesSeen = 0;
    var comment;
    var numChildren;
    this.goOffline();
    do {
      displayData = this.prevMove();
      comment = this.movetree.properties().getOneValue('C');
      numChildren = this.movetree.node().numChildren();
      movesSeen++;
      if (maxMovesPrevious && movesSeen === maxMovesPrevious) {
        break;
      }
    } while (displayData && !comment && numChildren <= 1);
    // It's more expected to reset the 'next' variation to zero.
    this.setNextVariation(0);
    return this.flattenedState();
  },

  /**
   * Go to the next branch or comment.
   *
   * If maxMovesNext is defined, then we cap the number of moves at
   * maxMovesNext. Otherwise, we keep going until we hit the beginning of
   * the game.
   *
   * Returns null in the case that we're at the root already.
   */
  nextCommentOrBranch: function(maxMovesNext) {
    var displayData = null;
    var movesSeen = 0;
    var comment;
    var numChildren;
    this.goOffline();
    do {
      displayData = this.nextMove();
      comment = this.movetree.properties().getOneValue('C');
      numChildren = this.movetree.node().numChildren();
      movesSeen++;
      if (maxMovesNext && movesSeen === maxMovesNext) {
        break;
      }
    } while (displayData && !comment && numChildren <= 1); 
    return this.flattenedState();
  },

  /**
   * Move up what variation will be next retrieved.
   */
  moveUpVariations: function() {
    return this.setNextVariation((this.nextVariationNumber() + 1) %
        this.movetree.node().numChildren());
  },

  /**
   * Move down  what variation will be next retrieved.
   */
  moveDownVariations: function() {
    // Module is defined incorrectly for negative numbers.  So, we need to add n
    // to the result.
    return this.setNextVariation((this.nextVariationNumber() - 1 +
        this.movetree.node().numChildren()) %
        this.movetree.node().numChildren());
  },

  /**
   * Get the possible next moves.  Used to verify that a click is actually
   * reasonable.
   *
   * Implemented as a map from point-string+color to variationNumber:
   *  e.g., pt-BLACK : 1.  For pass, we use 'PASS' as the point string.  This is
   *  sort of a hack and should maybe be rethought.
   */
  _possibleNextMoves: function() {
    var possibleMap = {};
    var nextMoves = this.movetree.nextMoves();
    for (var i = 0; i < nextMoves.length; i++) {
      var move = nextMoves[i];
      var firstString = move.point !== undefined ?
          move.point.toString() : 'PASS';
      var key = firstString + '-' + (move.color);
      possibleMap[key] = i;
    }
    return possibleMap;
  }
};
