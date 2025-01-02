import * as luxon from 'https://cdn.jsdelivr.net/npm/luxon@3.5.0/+esm'
import { DateTime } from 'https://cdn.jsdelivr.net/npm/luxon@3.5.0/+esm'

///////////////////////////////////////////////////////////////////////////////
//                             Exported Globals                              //
///////////////////////////////////////////////////////////////////////////////
window.luxon ??= luxon;

/** @typedef {(time: luxon.DateTimeMaybeValid) => void} ClockUpdaterFunction */
/**
 * @typedef {{ UTC: string, [clockName: string]: string }} ClockDefinitons
 * Key -> Clock name, Value -> Clock offset (can be in format: UTC+01:00, EST, or America/New_York)
 */

/**
 * @template {HTMLElement} TType
 * @param {string} elementId
 * @param {{ new(): TType; name: string; }} [type]
 * @returns {TType}
 */
function getKnownElementById(elementId, type) {
	const element = document.getElementById(elementId);
	if (!element) {
		throw new ReferenceError(`Element with id "${elementId}" was expected in document, but was missing.`)
	}

	if (type && !(element instanceof type)) {
		throw new TypeError(`Element with id "${elementId}" was expected to be of type ${type.name} but was actually of type ${element.constructor?.name}`);
	}

	// @ts-ignore
	return element;
}

/**
 * @template {HTMLElement} TType
 * @param {HTMLElement | ParentNode} parent
 * @param {string} selector
 * @param {{ new(): TType; name: string; }} [type]
 * @returns {TType}
 */
function queryKnownSelector(parent, selector, type) {
	const element = parent.querySelector(selector);

	if (!element) {
		let parentName;
		if (parent === document) {
			parentName = "document";
		}
		else if ('classList' in parent) {
			if (parent.id) {
				parentName = parent.id;
			}
			else {
				parentName = parent.tagName;
				if (parent.classList.length) {
					parentName = `${parentName} ${parent.classList}`;
				}
			}
		}
		throw new ReferenceError(`Element with selector "${selector}" was expected under ${parentName}, but was missing.`)
	}

	if (type && !(element instanceof type)) {
		throw new TypeError(`Element with selector "${selector}" was expected to be of type ${type.name} but was actually of type ${element.constructor?.name}`);
	}

	// @ts-ignore
	return element;
}

/**
 * @template {Node} TType
 * @param {{ new(): TType; name: string; }} type
 * @param {Node} node
 * @returns {TType}
 */
function castNode(type, node) {
	if (type && !(node instanceof type)) {
		throw new TypeError(`Node "${node}" was expected to be of type ${type.name} but was actually of type ${node.constructor?.name}`);
	}

	// @ts-ignore
	return node;
}

class WorldClocks {
	/**
	 * @type {ClockUpdaterFunction[]}
	 * @readonly
	 */
	clockUpdaterFunctions = [];

	/** @type {luxon.DateTimeMaybeValid} */
	referenceDateTime = DateTime.utc();

	static #getSortedClockDefinitions() {
		const clockDefinitions = WorldClocks.ClockDefinitions;

		const now = DateTime.utc();

		const sorted = Object.entries(clockDefinitions).sort(([, offsetA], [, offsetB]) => {
			return now.setZone(offsetA).offset - now.setZone(offsetB).offset;
		});

		return sorted;
	}
	/**  Gets or sets the clock definitons from or to local storage. */
	static get ClockDefinitions() {
		/** @type {ClockDefinitons} */
		let clockDefinitions = {};

		const clockDefStr = window.localStorage.getItem('clocks');
		if (clockDefStr) {
			clockDefinitions = JSON.parse(clockDefStr);
			clockDefinitions.UTC = 'UTC';
		}
		else {
			clockDefinitions = { UTC: 'UTC' };
			window.localStorage.setItem('clocks', JSON.stringify(clockDefinitions));
		}

		return clockDefinitions;
	}
	static set ClockDefinitions(value) {
		window.localStorage.setItem('clocks', JSON.stringify(value));
	}

	static get ReferenceClockName() {
		let refClock = window.localStorage.getItem('ref');
		return refClock;
	}
	static set ReferenceClockName(value) {
		window.localStorage.setItem('ref', value);
	}

	init() {
		this.loadClockGallery();
		getKnownElementById('refresh-clocks', HTMLButtonElement).addEventListener('click', () => this.updateClocks());
		getKnownElementById('add-clock').addEventListener('click', () => this.#showEditClockPopup());

		const newClockPopup = getKnownElementById('new-clock-modal', HTMLDialogElement);
		newClockPopup.querySelectorAll('input[type=text]').forEach(input => {
			castNode(HTMLInputElement, input).addEventListener('change', (e) => {
				// @ts-ignore
				castNode(HTMLInputElement, e.target)?.setCustomValidity('');
			});
		});
		newClockPopup.addEventListener('submit', (e) => {
			const newName = getKnownElementById('new-clock-name', HTMLInputElement);
			const newOffset = getKnownElementById('new-clock-offset', HTMLInputElement);

			if (newName.validity.valid  === false || newOffset.validity.valid === false) {
				e.preventDefault();
				return;
			}

			const newNameValue = newName.value?.trim();
			const newOffsetValue = newOffset.value?.trim();

			if (newNameValue.toUpperCase() === 'UTC') {
				newName.setCustomValidity('UTC cannot be edited');
				e.preventDefault();
				return;
			}
			else {
				newName.setCustomValidity('');
			}

			const clockDefinitions = WorldClocks.ClockDefinitions;
			if (newOffsetValue) {
				if (luxon.Info.normalizeZone(newOffsetValue)?.isValid) {
					newOffset.setCustomValidity('');
				}
				else {
					e.preventDefault();
					newOffset.setCustomValidity('Invalid offset value');
					return;
				}
				clockDefinitions[newNameValue] = newOffsetValue;
			}
			else {
				delete clockDefinitions[newNameValue];
			}

			WorldClocks.ClockDefinitions = clockDefinitions;
			this.loadClockGallery();
		});
		newClockPopup.addEventListener('close', (e) => {
			// @ts-ignore
			const popup = castNode(HTMLDialogElement, e.target);
			popup.querySelectorAll('input').forEach(input => {
				input.value = '.';
				input.reportValidity();
				input.setCustomValidity('');
			});
		});
		queryKnownSelector(document, '#new-clock-modal button[type="reset"]').addEventListener('click', () => {
			newClockPopup.close();
		});
	}

	/**
	 * Replaces the contents of a slot with the provided contents.
	 * @param {DocumentFragment} templateClone
	 * @param {string} slotName
	 * @param {HTMLElement | Text | string} contents
	 */
	#replaceSlotElement(templateClone, slotName, contents) {
		if (!templateClone) {
			return templateClone;
		}

		const slot = queryKnownSelector(templateClone, `slot[name="${slotName}"]`);
		if (!slot) {
			return slot;
		}

		// Replace strings with Text nodes
		if (!(contents instanceof HTMLElement) && !(typeof contents === 'object' && 'wholeText' in contents)) {
			const text = document.createTextNode(`${contents}`);
			contents = text;
		}

		if ('classList' in contents) { // missing for Text nodes
			contents.classList.add(slotName);
		}
		slot.replaceWith(contents);

		return contents;
	}

	/**
	 * @param {luxon.DateTimeMaybeValid} [dateTime]
	 */
	updateClocks(dateTime) {
		this.referenceDateTime = (dateTime?.setZone('UTC')) ?? luxon.DateTime.utc();
		this.clockUpdaterFunctions.forEach(fn => {
			fn(this.referenceDateTime);
		});
	}

	loadClockGallery() {
		const gallery = queryKnownSelector(document, '.clock-gallery', HTMLDivElement);
		const template = getKnownElementById('clock-template', HTMLTemplateElement);

		const sortedClocks = WorldClocks.#getSortedClockDefinitions();

		let referenceClockName = WorldClocks.ReferenceClockName;
		if (!sortedClocks.find(([name,]) => name === referenceClockName)) {
			referenceClockName = 'UTC';
			WorldClocks.ReferenceClockName = referenceClockName;
		}

		gallery.replaceChildren(); // Clear children
		this.clockUpdaterFunctions.slice(0, this.clockUpdaterFunctions.length);

		for (const [clockName, offset] of sortedClocks) {
			const clockFragment = castNode(DocumentFragment, template.content.cloneNode(true));
			const clockElement = castNode(HTMLElement, clockFragment.firstElementChild);

			const selected = clockName === referenceClockName;
			if (selected) {
				clockElement.dataset.selected = 'true';
			}
			clockElement.dataset.offset = offset;
			this.#replaceSlotElement(clockFragment, 'clock-selected', selected ? 'check_box' : 'check_box_outline_blank');

			this.#replaceSlotElement(clockFragment, 'clock-name', clockName);
			const clockOffsetElement = this.#replaceSlotElement(clockFragment, 'clock-offset', clockName);
			const clockTimeElement = this.#replaceSlotElement(clockFragment, 'clock-time', clockName);
			const clockDateElement = this.#replaceSlotElement(clockFragment, 'clock-date', clockName);

			this.clockUpdaterFunctions.push(dateTime => {
				const zonedDateTime = dateTime.setZone(offset);
				const referenceDate = dateTime.setZone(offset, { keepLocalTime: true });
				const isUtc = zonedDateTime.offset === 0;

				if (zonedDateTime.isValid) {
					clockTimeElement.textContent = zonedDateTime.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);

					if (isUtc) {
						clockOffsetElement.textContent = '\u202F'; // &nbsp;
						clockDateElement.textContent = zonedDateTime.toISODate();
					} else {
						clockOffsetElement.textContent = 'UTC' + zonedDateTime.toFormat('ZZ');
						clockDateElement.textContent = zonedDateTime.toRelativeCalendar({ base: referenceDate });
					}
				}
				else {
					clockTimeElement.textContent = '??:??';
					if (isUtc) {
						clockOffsetElement.textContent = '\u202F'; // &nbsp;
						clockDateElement.textContent = '????-??-??';
					} else {
						clockOffsetElement.textContent = '???';
						clockDateElement.textContent = '?';
					}
				}

			});

			const setSelectButton = queryKnownSelector(clockFragment, '.clock-actions button.set-selected', HTMLButtonElement);
			setSelectButton.addEventListener('click', this.#onClickSetSelected(clockName, selected));
			if (selected) {
				setSelectButton.title = '';
			}

			const editButton = queryKnownSelector(clockFragment, '.clock-actions button.edit', HTMLButtonElement);
			const deleteButton = queryKnownSelector(clockFragment, '.clock-actions button.delete', HTMLButtonElement);
			if (clockName === 'UTC') {
				editButton.disabled = true;
				editButton.hidden = true;
				deleteButton.disabled = true;
				deleteButton.hidden = true;
			} else {
				editButton.addEventListener('click', () => this.#showEditClockPopup(clockName, offset));
				deleteButton.addEventListener('click', () => this.#deleteClock(clockName));
			}

			gallery.appendChild(clockFragment);
		}

		this.updateClocks(this.referenceDateTime);
	}

	#onClickSetSelected(clockName, alreadySelected) {
		const self = this;
		return (function() {
			if (alreadySelected) {
				return;
			}

			WorldClocks.ReferenceClockName = clockName;

			self.loadClockGallery();
		}).bind(self);
	}

	/**
	 * @param {string} [name]
	 * @param {string} [offset]
	 */
	#showEditClockPopup(name, offset) {
		const popup = getKnownElementById('new-clock-modal', HTMLDialogElement);

		const newName = getKnownElementById('new-clock-name', HTMLInputElement);
		const newOffset = getKnownElementById('new-clock-offset', HTMLInputElement);
		if (name) {
			newName.value = name;
			newOffset.value = offset;
		}
		else {
			newName.value = '';
			newOffset.value = '';
		}

		popup.showModal();
	}

	#deleteClock(name) {
		if (confirm(`Are you sure you want to delete "${name}"?`)) {
			const definitions = WorldClocks.ClockDefinitions;
			delete definitions[name];
			WorldClocks.ClockDefinitions = definitions;
			this.loadClockGallery();
		}
	}
}
Object.defineProperty(window, 'WorldClocks', { value: WorldClocks });

const worldClocks = new WorldClocks();
Object.defineProperty(window, 'worldClocks', { value: worldClocks });

worldClocks.init();


