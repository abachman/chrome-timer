// a simple countdown clock.

(function (window, undefined) {
'use strict';

var TIMER_FINISHED = 0,
    TIMER_RUNNING  = 1,
    TIMER_PAUSED   = 2,
    ticks_per_second = 5,
    cb,
    callbacks = ['tick', 'second', 'finish'],
    debug = function (message) {
      if (window.console !== undefined && window.console.log !== undefined && window.DEBUG) {
        window.console.log.apply(window.console, arguments);
      }
    },
    error = function (message) {
      if (window.console !== undefined && window.console.error !== undefined) {
        window.console.error.apply(window.console, arguments);
      }
    };

/***
 * Constructor.
 *
 * Takes callbacks object.
 *
 * callbacks can be:
 *   tick: function (clock) {}
 *     called on every tick. up to 5 times per second if tab is in the
 *     foreground, probably zero to one times per second if tab is
 *     backgrounded.
 *
 *   second: function (clock) {}
 *     called at most once per second, but time between calls may be greater if
 *     tab is backgrounded or browser gets lazy or busy.
 *
 *   finish: function (clock) {}
 *     called once when the clock finishes counting down.
 */
var Clock = function (callbacks) {
  this.callbacks = (callbacks || {});
  this.status    = TIMER_PAUSED;
};

/***
 * private:
 *
 * step forwards through time, one tick at a ... time
 */
Clock.prototype.next_tick = function () {
  if (!(this.status === TIMER_FINISHED || this.status === TIMER_PAUSED)) {
    var self = this;

    this.timeout = window.setTimeout(function () { self.next_tick() }, 1000 / ticks_per_second);
    this.call_tick();
    this.countdown();
  }
}

/***
 * private:
 *
 * populate zero padded strings version of time
 */
Clock.prototype.zero_pad = function () {
  this.zero_padded = (this.zero_padded || {});
  this.zero_padded.hours   = (this.hours < 10 ? '0' : '')   + String(this.hours);
  this.zero_padded.minutes = (this.minutes < 10 ? '0' : '') + String(this.minutes);
  this.zero_padded.seconds = (this.seconds < 10 ? '0' : '') + String(this.seconds);
  // dupe property for camel-casers
  this.zeroPadded = this.zero_padded;

  return this.zero_padded;
}

/**
 * private:
 *
 * generate the callback calling functions with appropriate error handling.
 */
for (var i=0; i < 3; i++) {
  cb = callbacks[i];
  Clock.prototype['call_' + cb] = (function (callbackType) {
    return function () {
      try {
        if (this.callbacks[callbackType] !== undefined)
          this.callbacks[callbackType](this);
      } catch (ex) {
        // don't crash because of lame callbacks
        error('[clock.js] Failed ' + callbackType + ' callback!', ex.message)
      }
    };
  })(cb);
}

/***
 * private:
 *
 * run every tick, check to see whether a second has passed
 */
Clock.prototype.countdown = function () {
  var elapsed_seconds = Math.floor((new Date().getTime() - this.start_time) / 1000);

  // how much time has actually passed
  this.remaining_seconds = this.requested_seconds - elapsed_seconds;

  // separate remaining_seconds into time components
  this.seconds = this.remaining_seconds % 60;
  this.minutes = Math.floor(this.remaining_seconds / 60) % 60;
  this.hours   = Math.floor(Math.floor(this.remaining_seconds / 60) / 60);
  this.zero_pad();

  // at least a second has passed, trigger callbacks
  if (this.seconds != this.previous.seconds || this.minutes != this.previous.minutes || this.hours != this.previous.hours) {
    if (this.hours <= 0 && this.minutes <= 0 && this.seconds <= 0) {
      this.call_second();
      this.call_finish();
      this.stop();
    } else {
      // call second callback
      this.call_second();
    }

    this.previous = {
      hours: this.hours,
      minutes: this.minutes,
      seconds: this.seconds
    }
  }
}

/***
 * Start the clock.
 */
Clock.prototype.start = function (hours, minutes, seconds) {
  this.hours   = hours || 0;
  this.minutes = minutes || 0;
  this.seconds = seconds || 0;

  debug(
    "[clock.js] starting clock at " +
    this.hours + ":" +
    this.minutes + ":" +
    this.seconds
  );

  // make sure we can check when the clock has rolled over
  this.previous = {h: 0, m: 0, s: 0};

  // total countown seconds
  this.remaining_seconds = this.hours * 3600 + this.minutes * 60 + this.seconds;
  this.requested_seconds = this.remaining_seconds;

  // clock is now in a prepared-but-paused state, we just have to unpause
  this.unpause();
}

Clock.prototype.unpause = function () {
  this.running = true;
  this.status = TIMER_RUNNING;
  this.start_time = new Date().getTime();

  // set requested_seconds to remaining so that unpausing doesn't reset the clock
  this.requested_seconds = this.remaining_seconds;

  this.next_tick();
}

/***
 * Stop the clock.
 */
Clock.prototype.stop = function () {
  this.status  = TIMER_PAUSED;
  this.running = false;
}

// alias `stop` to `pause`
Clock.prototype.pause = Clock.prototype.stop;

window.Clock = Clock;

})(window);

