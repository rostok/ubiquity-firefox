/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono DiCarlo <jdicarlo@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// = ExperimentalUtils =
//
// This is a library of experimental utility functions which may
// eventually be included in {{{CmdUtils}}} or {{{Utils}}}. Command
// authors may use functions in this library, but be aware that they
// may not be bug-free, and they have a high likelihood of changing
// or being removed at any time.
//
// Everything clients need is contained within
// the {{{ExperimentalUtils}}} namespace.

var ExperimentalUtils = {};

/* Proof of concept:  Overlord verbs and underling verbs.  Usage is
 * like:
 * ExperimentalUtils.makeOverlordVerb( { name: "add to"} );
 * ExperimentalUtils.makeUnderlingVerb( {name: "add to calendar"} );
 *
 * Still pretty hacky; not recommended for production use.
 */

ExperimentalUtils.OverlordCmdObj = function OverlordCmdObj(verb, modifier,
							   nounType) {
  this.name = verb;
  this._switchModifier = modifier;
  this.modifiers = {};
  this.modifiers[modifier] = nounType;
  this._underlingRegistry = {};
};
ExperimentalUtils.OverlordCmdObj.prototype = {
    execute: function( directObj, modifiers ) {
      // delegate
      var choice = modifiers[this._switchModifier].text;
      var underling = this._underlingRegistry[choice];
      if (underling)
	underling.execute(directObj, modifiers );
      else
	displayMessage("Overlord verb with undefined underling " + choice);
    },
    preview: function( pBlock, directObj, modifiers ) {
      // delegate
      var choice = modifiers[this._switchModifier].text;
      var underling = this._underlingRegistry[choice];
      if (underling)
	underling.preview( pBlock, directObj, modifiers );
      else
	pBlock.innerHTML = "Overlord verb with unrecognized choice " + choice;
    },
    registerNewUnderling: function(argumentValue, options) {
      this._underlingRegistry[argumentValue] = options;
    }
};

ExperimentalUtils.OverlordNounType = function OverlordNounType() {
  this._underlingChoices = [];
};
ExperimentalUtils.OverlordNounType.prototype = {
    suggest: function(text, html, callback) {
      // Work like the generic noun type.
      // But put the "options" dict of the underling verb in the .data
      // property of the returned suggestion.
      var suggestions = [];
      for each ( var choiceName in this._underlingChoices) {
	if (choiceName.indexOf(text) > -1 ) {
	  suggestions.push( CmdUtils.makeSugg( choiceName ) );
	}
      }
      return suggestions;
    },
    'default': function() {
      // Always return something as default for the
      // switchModifier, since the overlord verb can't run without one.
      // When we allow multiple defaults, this should return everything!
      var defaults = [];
      for each ( var choiceName in this._underlingChoices) {
	defaults.push( CmdUtils.makeSugg(choiceName));
      }
      return defaults;
    },
    addNewValue: function( newValue, options ) {
      this._underlingChoices.push( newValue );
    }
};

ExperimentalUtils.makeOverlordVerb = function makeOverlordVerb( name ) {
  // name must be of the form "add to"
  var globalObj = CmdUtils.__globalObject;
  var words = name.split(" ");
  var overlordVerb = words[0];
  var switchModifier = words[1];

  var autoGeneratedNounType = new ExperimentalUtils.OverlordNounType();

  var overlordCmdObj = new ExperimentalUtils.OverlordCmdObj( overlordVerb,
				                    switchModifier,
						    autoGeneratedNounType);
  var execute = function() {
    overlordCmdObj.execute.apply(overlordCmdObj, arguments);
  };
  // Reserved keywords that shouldn't be added to the cmd function.
  var RESERVED = ["takes", "execute", "name"];
  // Add all other attributes of options to the cmd function.
  for( var key in overlordCmdObj ) {
    if( RESERVED.indexOf(key) == -1 )
      execute[key] = overlordCmdObj[key];
  }
  execute.modifiers[switchModifier] = autoGeneratedNounType;

  // TODO big issue here:  The overlord verb needs to accept any additional
  // arguments that *any* of its underling verbs can accept.  How will we
  // do that??
  // TODO need to be able to produce suggestion based on *two* *nouns* --
  // one for the selector argument and one for another argument -- so that
  // 'calendar pants' will complete to 'add-to-calendar pants'.  The parser
  // doesn't do this yet -- noun-first suggestion tries to send all input
  // to the same noun.
  // TODO this is a hack: assume we always take arb text direct obj
  execute.DOLabel = "object";
  execute.DOType = globalObj["noun_arb_text"];

  // TODO set various other attributes on overlordCmdObj... documentation
  // strings, for instance, would be good.
  globalObj["noun_type_" + overlordVerb + "_" + switchModifier + "_arg"] =
    autoGeneratedNounType;

  // TODO if an overlord verb is *empty*, then it should be kept out of
  // the namespace of things that can be suggested.  Not sure how to
  // accomplish this.  Maybe we could set a 'disabled' property on it,
  // and then in makeUnderlingVerb, remove the disabled property because
  // it now has at least one underling?

  globalObj["cmd_" + overlordVerb] = execute;
};

ExperimentalUtils.makeUnderlingVerb = function makeUnderlingVerb( options ) {
  // options.name must be of the form "add to calendar".
  var globalObj = CmdUtils.__globalObject;
  var words = options.name.split(" ");
  var overlordVerb = words[0];
  var switchModifier = words[1];
  var myArgumentValue = words[2];

  // TODO make sure there's not already an underling verb with the
  // same name.
  var nounType = globalObj["noun_type_" + overlordVerb + "_"
                           + switchModifier + "_arg"];
  if (!nounType) {
    // TODO handle error
  }
  var overlordVerbObj = globalObj["cmd_" + overlordVerb];
  if (!overlordVerbObj) {
    // TODO handle error
  }
  overlordVerbObj.registerNewUnderling( myArgumentValue, options );
  nounType.addNewValue( myArgumentValue, options );
  // TODO the underling verb should have its own entry in command-list
  // etc. How do we do that?
};
