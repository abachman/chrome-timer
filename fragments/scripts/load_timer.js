var displayTime = function (time) {
  $('#hours').text(time.hours);
  $('#minutes').text(time.minutes);
  $('#seconds').text(time.seconds);
}

// listen for the ticking of the clock.
chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type == 'second') {
    displayTime(message.time);
  } else if (message.type == 'finish') {
    $('#start_button').text('Start');
    $('#timer-container').addClass('highlight');
  }
});

var Grower = function (container) {
  this.timer  = this.container = container;
  this.button = $('#nav')
  this.button_offsets = {
    width:  this.button.outerWidth(true),
    height: this.button.outerHeight(true)
  }
  this.update_dimensions()

  // growth directions
  this.SMALLER = 0
  this.LARGER  = 1

  // every time grow direction changes
  this.font_growth_step = 1
  this.growth_direction = null
  this.direction_changes = 0
}

Grower.prototype.font_size = function () {
  return Number(this.timer.css('font-size').split('px')[0])
}

Grower.prototype.update_dimensions = function () {
  this.offsets = {
    width: this.timer.width(),
    height: this.timer.height()
  }
  this.display = {
    width:  $(window).width(),
    height: $(window).height()
  }
}

Grower.prototype.place = function () {
  this.update_dimensions()

  this.timer.css('left', (this.display.width / 2) - (this.offsets.width / 2) + 'px')
  this.timer.css('top',  (this.display.height / 4) - (this.offsets.height / 4) + 'px')

  this.button.css('left', this.timer.css('left'));
  // this.button.css('bottom', '10px')
}

// count how many times growth direction changes to prevent getting stuck
Grower.prototype.choose_growth_direction = function () {
  if (this.offsets.width > this.display.width) { // SHRINK
    // has direction changed?
    if (this.growth_direction === this.LARGER) {
      this.direction_changes++
    }

    this.growth_direction = this.SMALLER

    // make sure we're shrinking
    if (this.font_growth_step > 0) this.font_growth_step *= -1
  } else {
    // has direction changed?
    if (this.growth_direction === this.SMALLER) {
      this.direction_changes++
    }

    this.growth_direction = this.LARGER

    // make sure we're growing
    if (this.font_growth_step < 0) this.font_growth_step *= -1
  }
}

Grower.prototype.grow = function (options) {
  options = options || {}
  this.place()

  if (Math.abs((this.display.width - 40) - this.offsets.width) > 20 && this.direction_changes < 4) {
    this.choose_growth_direction()
    this.timer.css('font-size', this.font_size() + this.font_growth_step + 'px')
    this.grow()
  } else {
    // the right size has been reached
    this.growth_direction = null
    this.direction_changes = 0
  }
}

new Grower($('#timer-container')).grow()

// connect to timer app
var bg = chrome.extension.getBackgroundPage(),
    timer = bg.app;

function doTimerStart() {
  var hours   = Number($('#hours').text()),
      minutes = Number($('#minutes').text()),
      seconds = Number($('#seconds').text())

  if (hours + minutes + seconds > 0) {
    $('#timer-container').removeClass('highlight')
    $(this).text('Stop')

    timer.setTime({
      hours: hours,
      minutes: minutes,
      seconds: seconds
    })

    timer.start()
  }
}

function doTimerStop() {
  $(this).text('Start');
  timer.stop();
}

// start / stop button
$('#start_button').on('click', function () {
  if (!timer.isRunning()) {
    doTimerStart.call(this);
  } else {
    doTimerStop.call(this);
  }
});

displayTime(timer.state.displayTime);

var clock_has_focus;
$('.editable').
  attr('contenteditable', 'true').
  focus(function () { clock_has_focus = true; }).
  blur(function () {
    // sanitize
    var value = $(this).text()
    if (value.length == 0 || Number(value) == 0) {
      $(this).text('00')
    } else if (!/^[0-9]{1,2}$/.test(value)) {
      value = value.replace(/[^0-9]/,'').substr(0,2)
      $(this).text(value)
    } else {
      // prepend single digit numbers with a zero
      value = ((Number(value) < 10) ? '0' : '') + Number(value)
      $(this).text(value)
    }
    clock_has_focus = false
  }).
  keydown(function (evt) {
    // sanitize
    var k = evt.keyCode
    if (k === 27 || k === 13) {
      $(this).blur()
      evt.preventDefault()
    } else if (k === 32) {
      evt.preventDefault()
    }
  });

if (timer.settings.soundAlarm) {
  $('#alarm_check').prop('checked', true);
}

$('#alarm_check').on('change', function () {
  timer.settings.soundAlarm = $(this).is(':checked');
});
