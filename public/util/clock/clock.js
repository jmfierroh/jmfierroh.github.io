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

	init() {
		this.loadClockGallery();
		getKnownElementById('refresh-clocks', HTMLButtonElement).addEventListener('click', () => this.updateClocks());

		const newClockPopup = getKnownElementById('new-clock-modal', HTMLDialogElement);

		getKnownElementById('add-clock').addEventListener('click', () => newClockPopup.showModal());

		newClockPopup.addEventListener('submit', (e) => {
			const newName = getKnownElementById('new-clock-name', HTMLInputElement);
			const newOffset = getKnownElementById('new-clock-offset', HTMLInputElement);

			if (newName.validity.valid  === false || newOffset.validity.valid === false) {
				e.preventDefault();
				return;
			}

			const newNameValue = newName.value;
			const newOffsetValue = newOffset.value;

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
		newClockPopup.addEventListener('close', () => {
			newClockPopup.querySelectorAll('input').forEach(input => {
				input.value = '';
				input.reportValidity();
			});
		});
		queryKnownSelector(document, '#new-clock-modal button[type="reset"]').addEventListener('click', () => {
			newClockPopup.close();
		});
	}

	/**
	 * Replaces the contents of a slot with the provided contents.
	 * @param {HTMLElement} templateClone
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
		dateTime ??= luxon.DateTime.utc();
		this.clockUpdaterFunctions.forEach(fn => {
			fn(dateTime);
		});
	}

	loadClockGallery() {
		const gallery = queryKnownSelector(document, '.clock-gallery', HTMLDivElement);
		const template = getKnownElementById('clock-template', HTMLTemplateElement);

		const sortedClocks = WorldClocks.#getSortedClockDefinitions();

		gallery.replaceChildren(); // Clear children
		this.clockUpdaterFunctions.slice(0, this.clockUpdaterFunctions.length);

		for (const [clockName, offset] of sortedClocks) {
			/** @type {HTMLElement} */
			// @ts-ignore
			const clockElement = template.content.cloneNode(true); ///////////////////////////////// Clock element root

			this.#replaceSlotElement(clockElement, 'clock-name', clockName);
			const clockOffsetElement = this.#replaceSlotElement(clockElement, 'clock-offset', clockName);
			const clockTimeElement = this.#replaceSlotElement(clockElement, 'clock-time', clockName);
			const clockDateElement = this.#replaceSlotElement(clockElement, 'clock-date', clockName);

			this.clockUpdaterFunctions.push(dateTime => {
				// TODO: Logic in case provided dateTime is invalid
				const zonedDateTime = dateTime.setZone(offset);
				const referenceDate = dateTime.setZone(offset, { keepLocalTime: true });
				const isUtc = zonedDateTime.offset === 0;
				clockTimeElement.textContent = zonedDateTime.toLocaleString(luxon.DateTime.TIME_24_SIMPLE);

				if (isUtc) {
					clockOffsetElement.textContent = '\u202F'; // &nbsp;
					clockDateElement.textContent = zonedDateTime.toISODate();
				} else {
					clockOffsetElement.textContent = 'UTC' + zonedDateTime.toFormat('ZZ')
					clockDateElement.textContent = zonedDateTime.toRelativeCalendar({ base: referenceDate });
				}
			});
			gallery.appendChild(clockElement);
		}

		this.updateClocks(this.referenceDateTime);
	}
}
Object.defineProperty(window, 'WorldClocks', { value: WorldClocks });

const worldClocks = new WorldClocks();
Object.defineProperty(window, 'worldClocks', { value: worldClocks });

worldClocks.init();


