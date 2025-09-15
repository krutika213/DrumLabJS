/**
 * Plays a sound and animates the corresponding key when a key is pressed.
 */
function playSound(e) {
  // 1. Select the audio and key elements that match the key pressed
  const audio = document.querySelector(`audio[data-key="${e.keyCode}"]`);
  const key = document.querySelector(`.key[data-key="${e.keyCode}"]`);

  // 2. If no corresponding audio element exists, stop the function
  if (!audio) return;

  // 3. Add the 'playing' class for the visual effect
  key.classList.add('playing');

  // 4. Rewind the audio to the start (allows for rapid, repeated plays)
  audio.currentTime = 0;
  
  // 5. Play the sound
  audio.play();
}

/**
 * Removes the 'playing' class after the CSS transition has ended.
 */
function removeTransition(e) {
  // We only care about the 'transform' transition ending to avoid conflicts
  if (e.propertyName !== 'transform') return;
  
  // 'this' refers to the element the event was fired on (the .key div)
  this.classList.remove('playing');
}

// Get all elements with the class 'key'
const keys = document.querySelectorAll('.key');

// Listen for the 'transitionend' event on each key to remove the animation class
keys.forEach(key => key.addEventListener('transitionend', removeTransition));

// Listen for a 'keydown' event on the entire window
window.addEventListener('keydown', playSound);
