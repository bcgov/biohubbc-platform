// __mocks__/popper.js.js

// mocks will be picked up by vi and applied automatically.
// Required to make the material-ui select/autocomplete components work during unit tests
// See https://stackoverflow.com/questions/60333156/how-to-fix-typeerror-document-createrange-is-not-a-function-error-while-testi
import PopperJs from 'popper.js';

vi.mock('popper.js', () => {
  return {
    default: class Popper {
      constructor() {
        this.placements = PopperJs.placements;
        return {
          update: () => {},
          destroy: () => {},
          scheduleUpdate: () => {}
        };
      }
    }
  };
});
