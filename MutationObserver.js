/*
Straight up polyfill of mutationobserver for mootools
will lazy patch in the necessary polyfills 
See http://dev.opera.com/articles/view/mutation-observers-tutorial/ for usage

The fallback for MutationRecord will return an `Elements` collection in place of NodeList

Goals: keep this async and batch changes (gotta use setInterval)
*/
(function(window) {
    window.MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    if (!window.MutationObserver) {
        var MutationRecord = window.MutationRecord = function(data) {
            Object.each(data, function(v,k) {
                this[k] = v;
            }, this);
        }
        MutationRecord.prototype = {
            target: null,
            type: null,
            addedNodes: [],
            removedNodes: [],
            attributeName: null,
            oldValue: null
        };

        var push = Array.prototype.push;
        var getChildren = function($e) {
            return new Elements($e.children);
        };
        var getAttributes = function($e, filter) { //store dynamic attributes in a object
            var attrs = {};
            var attributes = $e.attributes;
            for (var i = attributes.length - 1; i >= 0; i--) {
                if(!filter || filter[attributes[i].name]) {
                    attrs[attributes[i].name] = attributes[i].value;
                }
            }
            return attrs;
        };
        var noop = function() {};
        var patches = {
            attributes: function(element, filter) {
                if(Type.isArray(filter)) {
                    filter = filter.reduce(function(a, b) {a[b] = true; return a;}, {});
                } else {
                    filter = null;
                }
                var $old = getAttributes(element, filter);
                return function() {
                    var changed = [];
                    var old = $old;
                    var attr = getAttributes(element, filter);
                    $old = attr;

                    Object.each(attr, function(val, prop) {
                        if (old[prop] !== val) {
                            changed.push(new MutationRecord({
                                target: element,
                                type: 'attributes',
                                attributeName: prop,
                                oldValue: old[prop]
                            }));
                        }
                        delete old[prop];
                    });
                    Object.each(old, function(val, prop) {
                        changed.push(new MutationRecord({
                            target: element,
                            type: 'attributes',
                            attributeName: prop,
                            oldValue: old[prop]
                        }));
                    });
                    return changed;
                };
            },

            attributeFilter: noop,
            attributeOldValue: noop,

            childList: function(element) {
                var $old = getChildren(element);
                return function() {
                    var changed = [];
                    var old = $old;
                    var kids = getChildren(element);
                    $old = kids;

                    kids.each(function($e) {
                        var index = old.indexOf($e);
                        if (index !== -1) {
                            old.splice(index, 1);
                        } else {
                            changed.push(new MutationRecord({
                                target: element,
                                type: 'childList',
                                addedNodes: [$e]
                            }));
                        }
                    });
                    //rest are clearly removed
                    old.each(function($e) {
                        changed.push(new MutationRecord({
                            target: element,
                            type: 'childList',
                            removedNodes: [$e]
                        }));
                    });
                    return changed;
                };
            }
        };

        window.MutationObserver = new Class({
            options: {
                period: 25 //recheck interval
            },

            _intervals: [],

            _watched: [],

            initialize: function(listener) {
                this._listener = listener;
            },

            observe: function(target, config) {
                var self = this;

                if(config.attributeFilter && config.attributes) {
                    config.attributes = config.attributeFilter;
                }

                Object.each(config, function(use, type) {
                    if (use) {
                        var patch = patches[type].call(self, target, use);
                        if(patch) self._watched.push(patch);
                    }
                });

                this._intervals.push(this._watch.periodical(this.options.period, this));
            },

            _watch: function() {
                var changed = [];

                this._watched.each(function(watcher) {
                    var data = watcher();//expected array
                    if(data) push.apply(changed, data);
                });

                if (changed.length > 0) { //fire away
                    this._listener(changed, this);
                }
            },

            disconnect: function() {
                this._intervals.each(function(t) {clearInterval(t);});//ie throws a fit if u dont wrap clear
            }

        });
    }
})(window);
