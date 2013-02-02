var Timer = function (container) {
  this.timer  = this.container = container
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

Timer.prototype.font_size = function () {
  return Number(this.timer.css('font-size').split('px')[0])
}

Timer.prototype.update_dimensions = function () {
  this.offsets = {
    width: this.timer.width(),
    height: this.timer.height()
  }
  this.display = {
    width:  $(window).width(),
    height: $(window).height()
  }
}

Timer.prototype.place = function () {
  this.update_dimensions()

  this.timer.css('left', (this.display.width / 2) - (this.offsets.width / 2) + 'px')
  this.timer.css('top',  (this.display.height / 2) - (this.offsets.height / 2) + 'px')

  this.button.css('left', (this.display.width - this.button_offsets.width - 20) + 'px')
  this.button.css('bottom', '10px')
}

// count how many times growth direction changes to prevent getting stuck
Timer.prototype.choose_growth_direction = function () {
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

Timer.prototype.grow = function (options) {
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

// update display given a time
Timer.prototype.update = function (time) {
  var dh = (time.hours < 10 ? '0' : '') + String(time.hours),
      dm = (time.minutes < 10 ? '0' : '') + String(time.minutes),
      ds = (time.seconds < 10 ? '0' : '') + String(time.seconds)

  $('#hours', this.container).text(dh)
  $('#minutes', this.container).text(dm)
  $('#seconds', this.container).text(ds)
}

var ALARM
function sound_alarm() {
  ALARM.load()
  ALARM.play()
}

var startTimer

$(function () {
  // preload alarm sound

  // from underscore.js
  var debounce = function(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  var timer = new Timer($('#timer-container'))

  debounced_growth = debounce(function () { timer.grow({fast:true}) }, 200)

  // keep timer clean
  $(window).resize(debounced_growth)

  var clock_has_focus = false;
  $('.editable').attr('contenteditable', 'true').
  focus(function () {
    clock_has_focus = true;
  }).
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
  })

  // use spacebar to toggle checkbox
  $('input').
    focus(function () {clock_has_focus=true}).
    blur(function () {clock_has_focus=false})

  // initialize clock
  c = new Clock({
      tick: function (clock) {
        // every animation frame, perform animations in here
      },
      second: function (clock) {
        timer.update(clock)
      },
      finish: function (clock) {
        active = false
        $('#start_button').text('Start')
        $('#timer-container').addClass('highlight')
        if ($('#alarm-check').is(':checked')) {
          sound_alarm()
        }
      }
  })

  $('#start_button').click(function (evt) {
    evt.preventDefault()

    if (c.running) {
      console.log("STOP IT")
      c.stop()
      $(this).text('Start')
    } else {
      // get times
      var hours   = Number($('#hours').text()),
          minutes = Number($('#minutes').text()),
          seconds = Number($('#seconds').text())

      if (hours + minutes + seconds > 0) {
        $('#timer-container').removeClass('highlight')
        $(this).text('Stop')

        c.start(hours, minutes, seconds)
      }
    }
  })

  // simple toggle
  $(document).keydown(function (evt) {
    if (!clock_has_focus && evt.keyCode == 32) $('#start_button').click()
  })
})

// position timer initially
try {
  $('#hours, #minutes, #seconds').on('click', function () { document.execCommand('selectAll',false,null); })
  new Timer($('#timer-container')).grow()
} catch (ex) {
  console.log("EXCEPTION!", ex.message);
}
