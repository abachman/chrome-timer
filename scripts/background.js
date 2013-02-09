// initially this is a no-op. Pop resets it to a callback when it loads.
var popupCallback = function () {}

var Settings = {
  soundAlarm: true
};

var TimerState = {
  running: false,
  time: {
    hours: 0,
    minutes: 5,
    seconds: 0
  },
  displayTime: {
    hours: '00',
    minutes: '05',
    seconds: '00',
  },
  // initial default time
  defaultTime: {
    hours: 0,
    minutes: 5,
    seconds: 0
  },
  defaultDisplayTime: {
    hours: '00',
    minutes: '05',
    seconds: '00',
  }
}

function clearBadge() {
  chrome.browserAction.setBadgeText({text: ""});
  chrome.browserAction.setBadgeBackgroundColor({color: [255, 255, 255, 0]});
}

function sound_alarm() {
  // http://www.freesound.org/people/Traveler/sounds/13722/
  var ALARM    = document.createElement('audio'),
      soundUrl = chrome.extension.getURL("assets/wine-glass-alarm.ogg");
  ALARM.src = soundUrl;
  ALARM.load();
  ALARM.load();
  ALARM.play();
}

var TimerApp = function () {
  var self = this;
  this.state = TimerState;
  this.settings = Settings;
  this.clock = new Clock({
    second: function (clock) {
      // console.log("TICK", clock);
      self.update(clock);
    },
    finish: function (clock) {
      chrome.browserAction.setBadgeText({text: " ! "});
      chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});

      var notification = webkitNotifications.createNotification(
        chrome.extension.getURL('icons/48.png'),  // icon url - can be relative
        "Time's up!",       // notification title
        "Timer has finished."
      );
      notification.show();

      self.state.running = false;
      if (self.settings.soundAlarm) {
        sound_alarm();
      }
    }
  });
}

TimerApp.prototype.reset = function () {
  this.state.time = this.state.defaultTime;
  this.update(this.state.time);
}

TimerApp.prototype.setTime = function (time) {
  // if given time is different than the existing time, than time fields
  // were updated and we should save the given values as the new default
  // time.

  if (time.hours   != this.state.time.hours ||
      time.minutes != this.state.time.minutes ||
      time.seconds != this.state.time.seconds) {
    this.state.defaultTime = time;
    this.state.defaultDisplayTime = this._getDisplayableTime(time);
  }

  this.state.time = time;
  this.state.displayTime = this._getDisplayableTime(time);
}

TimerApp.prototype._getDisplayableTime = function (time) {
  var dh = (time.hours < 10 ? '0' : '') + String(time.hours),
      dm = (time.minutes < 10 ? '0' : '') + String(time.minutes),
      ds = (time.seconds < 10 ? '0' : '') + String(time.seconds)
  return {
    hours: dh,
    minutes: dm,
    seconds: ds
  };
}

TimerApp.prototype.start = function () {
  clearBadge();
  this.state.running = true;
  this.clock.start(this.state.time.hours, this.state.time.minutes, this.state.time.seconds);
}

TimerApp.prototype.stop = function () {
  this.state.running = false;
  this.clock.stop();
}

TimerApp.prototype.update = function (time) {
  // send time updated time to popup
  this.setTime(time);

  if (this.state.time.hours <= 0 && this.state.time.minutes <= 0) {
    chrome.browserAction.setBadgeBackgroundColor({color: [51, 51, 51, 255]});
    chrome.browserAction.setBadgeText({text: this.state.time.minutes + ":" + this.state.displayTime.seconds});
  }

  // send time update message
  chrome.extension.sendMessage(null, {
    type: 'second',
    time: this.state.displayTime
  });
}

TimerApp.prototype.isRunning = function () {
  return this.state.running;
}

var app = new TimerApp();
