import { debounce } from 'lodash';

import { createAlert } from '~/alert';
import axios from '~/lib/utils/axios_utils';
import { __ } from '~/locale';
import InputValidator from '~/validators/input_validator';
import Tracking from '~/tracking';
import FormErrorTracker from '~/pages/shared/form_error_tracker';

const debounceTimeoutDuration = 1000;
const rootUrl = gon.relative_url_root;
const invalidInputClass = 'gl-field-error-outline';
const successInputClass = 'gl-field-success-outline';
const successMessageSelector = '.validation-success';
const pendingMessageSelector = '.validation-pending';
const unavailableMessageSelector = '.validation-error';

export default class UsernameValidator extends InputValidator {
  constructor(opts = {}) {
    super();

    const container = opts.container || '';
    const validateLengthElements = document.querySelectorAll(`${container} .js-validate-username`);

    this.debounceValidateInput = debounce((inputDomElement) => {
      UsernameValidator.validateUsernameInput(inputDomElement);
    }, debounceTimeoutDuration);

    validateLengthElements.forEach((element) =>
      element.addEventListener('input', this.eventHandler.bind(this)),
    );
  }

  eventHandler(event) {
    const inputDomElement = event.target;

    UsernameValidator.resetInputState(inputDomElement);
    this.debounceValidateInput(inputDomElement);
  }

  static validateUsernameInput(inputDomElement) {
    const username = inputDomElement.value;

    if (username.length > 1 && inputDomElement.checkValidity()) {
      UsernameValidator.setMessageVisibility(inputDomElement, pendingMessageSelector);
      UsernameValidator.fetchUsernameAvailability(username)
        .then((usernameTaken) => {
          UsernameValidator.setInputState(inputDomElement, !usernameTaken);
          UsernameValidator.setMessageVisibility(inputDomElement, pendingMessageSelector, false);
          UsernameValidator.setMessageVisibility(
            inputDomElement,
            usernameTaken ? unavailableMessageSelector : successMessageSelector,
          );

          if (usernameTaken) {
            const action = FormErrorTracker.action(inputDomElement);
            const label = FormErrorTracker.label(inputDomElement, 'is_taken');

            Tracking.event(undefined, action, { label });
          }
        })
        .catch(() =>
          createAlert({
            message: __('An error occurred while validating username'),
          }),
        );
    }
  }

  static fetchUsernameAvailability(username) {
    return axios.get(`${rootUrl}/users/${username}/exists`).then(({ data }) => data.exists);
  }

  static setMessageVisibility(inputDomElement, messageSelector, isVisible = true) {
    const messageElement = inputDomElement.parentElement.querySelector(messageSelector);
    messageElement.classList.toggle('hide', !isVisible);
  }

  static setInputState(inputDomElement, success = true) {
    inputDomElement.classList.toggle(successInputClass, success);
    inputDomElement.classList.toggle(invalidInputClass, !success);
  }

  static resetInputState(inputDomElement) {
    UsernameValidator.setMessageVisibility(inputDomElement, successMessageSelector, false);
    UsernameValidator.setMessageVisibility(inputDomElement, unavailableMessageSelector, false);

    if (inputDomElement.checkValidity()) {
      inputDomElement.classList.remove(successInputClass, invalidInputClass);
    }
  }
}
