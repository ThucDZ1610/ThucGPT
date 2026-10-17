#!/usr/bin/env node

const readline = require('readline');

const MODES = new Set(['auto', 'binary', 'ascii', 'unicode', 'hex', 'a1z26']);

function cleanInput(value) {
	return String(value ?? '').trim();
}

function decodeBinary(value) {
	const bits = value.replace(/\s+/g, '');
	if (!/^[01]+$/.test(bits)) throw new Error('Ma binary chi duoc chua 0 va 1.');
	if (bits.length % 8 !== 0) throw new Error('Chuoi binary phai co so bit chia het cho 8.');
	const bytes = [];
	for (let index = 0; index < bits.length; index += 8) {
		bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
	}
	return Buffer.from(bytes).toString('utf8');
}

function getNumberTokens(value, label) {
	const tokens = value.trim().split(/[\s,;|]+/).filter(Boolean);
	if (!tokens.length || tokens.some((token) => !/^\d+$/.test(token))) {
		throw new Error(`${label} can cac so duoc ngan cach bang khoang trang, dau phay hoac dau cham phay.`);
	}
	return tokens.map((token) => Number(token));
}

function decodeAscii(value) {
	const compact = value.replace(/\s+/g, '');
	const tokens = /\s|[,;|]/.test(value) ? getNumberTokens(value, 'ASCII') : null;
	const numbers = tokens || (compact.length % 3 === 0
		? compact.match(/.{3}/g).map((token) => Number(token))
		: [Number(compact)]);
	if (numbers.some((number) => !Number.isInteger(number) || number < 0 || number > 255)) {
		throw new Error('ASCII phai nam trong khoang 0-255 va nen cach nhau bang dau ngan cach.');
	}
	return Buffer.from(numbers).toString('utf8');
}

function decodeUnicode(value) {
	const numbers = getNumberTokens(value, 'Unicode');
	try {
		return String.fromCodePoint(...numbers);
	} catch {
		throw new Error('Unicode co ma code point khong hop le.');
	}
}

function decodeHex(value) {
	const hex = value.replace(/\s+/g, '').replace(/0x/gi, '');
	if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
		throw new Error('Ma hex phai la cac cap ky tu tu 0-9 va A-F.');
	}
	return Buffer.from(hex, 'hex').toString('utf8');
}

function decodeA1Z26(value) {
	return getNumberTokens(value, 'A1Z26').map((number) => {
		if (number === 0) return ' ';
		if (number < 1 || number > 26) throw new Error('A1Z26 chi nhan so tu 1-26; so 0 la khoang trang.');
		return String.fromCharCode(64 + number);
	}).join('');
}

function encodeBinary(value) {
	return [...Buffer.from(value, 'utf8')]
		.map((byte) => byte.toString(2).padStart(8, '0'))
		.join(' ');
}

function encodeAscii(value) {
	const numbers = [...value].map((character) => character.codePointAt(0));
	if (numbers.some((number) => number > 127)) {
		throw new Error('ASCII chi ho tro ky tu khong dau trong khoang 0-127.');
	}
	return numbers.join(' ');
}

function encodeUnicode(value) {
	return [...value].map((character) => character.codePointAt(0)).join(' ');
}

function encodeHex(value) {
	return [...Buffer.from(value, 'utf8')]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join(' ');
}

function encodeA1Z26(value) {
	return [...value.toUpperCase()].map((character) => {
		if (character === ' ') return '0';
		if (character < 'A' || character > 'Z') {
			throw new Error('A1Z26 chi ho tro chu cai A-Z va khoang trang.');
		}
		return character.charCodeAt(0) - 64;
	}).join(' ');
}

function autoMode(value) {
	const compact = value.replace(/\s+/g, '');
	if (/^[01]+$/.test(compact) && compact.length % 8 === 0) return 'binary';
	if (/^(?:0x)?[0-9a-f]+(?:\s+(?:0x)?[0-9a-f]+)*$/i.test(value) && /[a-f]/i.test(value)) return 'hex';
	if (/^\d+$/.test(compact) && compact.length > 3 && compact.length % 3 === 0) return 'ascii';
	if (/^\d+(?:[\s,;|]+\d+)*$/.test(value)) {
		const numbers = getNumberTokens(value, 'Ma so');
		if (numbers.every((number) => number >= 0 && number <= 26)) return 'a1z26';
		if (numbers.every((number) => number >= 0 && number <= 255)) return 'ascii';
	}
	return null;
}

function decode(value, mode = 'auto') {
	const input = cleanInput(value);
	if (!input) throw new Error('Chua co ma de giai.');
	if (!MODES.has(mode)) throw new Error(`Che do khong hop le: ${mode}.`);
	const selectedMode = mode === 'auto' ? autoMode(input) : mode;
	if (!selectedMode) {
		throw new Error('Khong tu nhan dang duoc. Hay dung --mode binary|ascii|unicode|hex|a1z26.');
	}
	const decoders = { binary: decodeBinary, ascii: decodeAscii, unicode: decodeUnicode, hex: decodeHex, a1z26: decodeA1Z26 };
	return { mode: selectedMode, text: decoders[selectedMode](input) };
}

function encode(value, mode) {
	const input = cleanInput(value);
	if (!input) throw new Error('Chua co chu de ma hoa.');
	if (!mode || mode === 'auto' || !MODES.has(mode)) {
		throw new Error('Khi ma hoa, hay dung --mode binary|ascii|unicode|hex|a1z26.');
	}
	const encoders = { binary: encodeBinary, ascii: encodeAscii, unicode: encodeUnicode, hex: encodeHex, a1z26: encodeA1Z26 };
	return { mode, text: encoders[mode](input) };
}

function parseArguments(argumentsList) {
	let mode = 'auto';
	let shouldEncode = false;
	const input = [];
	for (let index = 0; index < argumentsList.length; index += 1) {
		if (argumentsList[index] === '--mode' || argumentsList[index] === '-m') mode = argumentsList[++index] || '';
		else if (argumentsList[index] === '--encode' || argumentsList[index] === '-e') shouldEncode = true;
		else input.push(argumentsList[index]);
	}
	return { mode, shouldEncode, input: input.join(' ') };
}

function ask(input, question) {
	return new Promise((resolve) => input.question(question, resolve));
}

async function interactiveMenu() {
	const input = readline.createInterface({ input: process.stdin, output: process.stdout });
	console.log('\n=== GIAI MA / MA HOA ===');
	while (true) {
		console.log('\n1. Nhap ma can giai');
		console.log('2. Nhap chu thanh ma');
		console.log('0. Thoat');
		const choice = (await ask(input, '\nChon: ')).trim();

		if (choice === '0') {
			input.close();
			console.log('Da thoat.');
			return;
		}

		try {
			if (choice === '1') {
				const value = await ask(input, 'Nhap ma can giai: ');
				const result = decode(value, 'auto');
				console.log(`Che do: ${result.mode}`);
				console.log(`Ket qua: ${result.text}`);
			} else if (choice === '2') {
				const value = await ask(input, 'Nhap chu can ma hoa: ');
				const mode = (await ask(input, 'Chon ma (binary/ascii/unicode/hex/a1z26): ')).trim().toLowerCase();
				const result = encode(value, mode);
				console.log(`Che do: ${result.mode}`);
				console.log(`Ket qua: ${result.text}`);
			} else {
				console.log('Lua chon khong hop le. Hay chon 1, 2 hoac 0.');
			}
		} catch (error) {
			console.error(`Loi: ${error.message}`);
		}
	}
}

async function main() {
	const { mode, shouldEncode, input } = parseArguments(process.argv.slice(2));
	if (!input && !shouldEncode && mode === 'auto') {
		await interactiveMenu();
		return;
	}
	const value = input;
	if (!value) {
		console.error('Hay nhap chuoi can xu ly.');
		process.exitCode = 1;
		return;
	}
	try {
		const result = shouldEncode ? encode(value, mode) : decode(value, mode);
		console.log(`${shouldEncode ? 'Ma hoa' : 'Giai ma'} - che do: ${result.mode}`);
		console.log(`Ket qua: ${result.text}`);
	} catch (error) {
		console.error(`Loi: ${error.message}`);
		process.exitCode = 1;
	}
}

if (require.main === module) main();

module.exports = { decode, encode };
