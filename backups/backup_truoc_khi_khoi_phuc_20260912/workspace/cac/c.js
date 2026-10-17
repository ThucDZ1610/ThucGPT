#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const readline = require('readline');

const downloadFolder = path.join(__dirname, 'downloads');
const videoFolder = path.join(__dirname, 'Video');
const taiXiuDataFolder = path.join(__dirname, 'data', 'taixiu');
const taiXiuStatePath = path.join(taiXiuDataFolder, 'state.json');

function ask(input, question) {
	return new Promise((resolve) => input.question(question, resolve));
}

function openChrome(url) {
	const chromePaths = [
		process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
		process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
		process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
	].filter(Boolean);

	const chromePath = chromePaths.find((chrome) => fs.existsSync(chrome));
	if (chromePath) execFile(chromePath, [url]);
	else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url]);
	else console.error('Khong tim thay Google Chrome tren may nay.');
}

function request(url, options = {}) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith('https') ? https : http;
		client.get(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
				...options.headers,
			},
		}, (response) => {
			if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
				response.resume();
				request(new URL(response.headers.location, url).toString(), options).then(resolve, reject);
				return;
			}
			if (response.statusCode < 200 || response.statusCode >= 300) {
				response.resume();
				reject(new Error(`HTTP ${response.statusCode}`));
				return;
			}
			const chunks = [];
			response.on('data', (chunk) => chunks.push(chunk));
			response.on('end', () => resolve({ body: Buffer.concat(chunks), headers: response.headers }));
		}).on('error', reject);
	});
}

function runYtDlp(args) {
	return new Promise((resolve, reject) => {
		const localYtDlp = process.env.LOCALAPPDATA
			&& path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe');
		const ytDlpCommand = localYtDlp && fs.existsSync(localYtDlp) ? localYtDlp : 'yt-dlp';
		execFile(ytDlpCommand, args, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) reject(new Error(stderr.trim() || error.message));
			else resolve(stdout.trim());
		});
	});
}

async function findImageUrls(keyword, limit) {
	const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(keyword)}`;
	const response = await request(googleUrl, { headers: { 'Accept-Encoding': 'identity' } });
	const html = response.body.toString('utf8').replaceAll('\\u003d', '=').replaceAll('\\u0026', '&').replaceAll('\\/', '/');
	const matches = html.match(/https?:\/\/[^"'\\\s<>]+/g) || [];
	const imageUrls = [];

	for (const match of matches) {
		const url = match.replace(/[),;]+$/, '');
		if (!/\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('encrypted-tbn')) continue;
		if (!imageUrls.includes(url)) imageUrls.push(url);
		if (imageUrls.length === limit) break;
	}
	if (imageUrls.length) return imageUrls;

	console.log('Google dang gioi han truy cap, chuyen sang nguon anh du phong...');
	const imageUrlsFromBing = [];
	for (let offset = 1; imageUrlsFromBing.length < limit && offset <= 351; offset += 35) {
		const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(keyword)}&first=${offset}`;
		const bingResponse = await request(bingUrl);
		const bingHtml = bingResponse.body.toString('utf8');
		const bingMatches = [...bingHtml.matchAll(/turl&quot;:&quot;(https?:\/\/.*?)&quot;/g)];
		for (const match of bingMatches) {
			const imageUrl = match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
			if (!imageUrlsFromBing.includes(imageUrl)) imageUrlsFromBing.push(imageUrl);
			if (imageUrlsFromBing.length === limit) break;
		}
	}
	return imageUrlsFromBing;
}

async function findVideoUrls(keyword, limit) {
	const normalizedKeyword = keyword.toLowerCase();
	const platformFilter = normalizedKeyword.includes('tiktok') ? 'site:tiktok.com' : '';
	const searchQuery = `"${keyword}" ${platformFilter}`.trim();
	const offsets = [1, 36];
	const pages = await Promise.all(offsets.map(async (offset) => {
		const bingUrl = `https://www.bing.com/videos/search?q=${encodeURIComponent(searchQuery)}&first=${offset}`;
		const response = await request(bingUrl);
		return [...response.body.toString('utf8').matchAll(/murl&quot;:&quot;(https?:\/\/.*?)&quot;/g)]
			.map((match) => match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&'));
	}));

	const videoUrls = [];
	for (const videoUrl of pages.flat()) {
		if (platformFilter && !videoUrl.toLowerCase().includes('tiktok.com')) continue;
		if (!videoUrls.includes(videoUrl)) videoUrls.push(videoUrl);
		if (videoUrls.length === limit) break;
	}
	return videoUrls;
}

function extensionFrom(response, imageUrl) {
	const contentType = (response.headers['content-type'] || '').split(';')[0].toLowerCase();
	const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
	if (extensions[contentType]) return extensions[contentType];
	const extension = path.extname(new URL(imageUrl).pathname).toLowerCase();
	return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension) ? extension : '.jpg';
}

function getDownloadedImages() {
	if (!fs.existsSync(downloadFolder)) return [];
	const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
	return fs.readdirSync(downloadFolder)
		.filter((filename) => imageExtensions.has(path.extname(filename).toLowerCase()))
		.sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));
}

async function deleteImages(input) {
	const images = getDownloadedImages();
	if (!images.length) {
		console.log('\nThu muc downloads khong co anh de xoa.');
		return;
	}

	const countInput = (await ask(input, `\nCo ${images.length} anh. Nhap so anh dau tien can xoa (hoac all): `)).trim().toLowerCase();
	const count = Number.parseInt(countInput, 10);
	if (countInput !== 'all' && (!Number.isInteger(count) || count < 1)) {
		console.log('So luong khong hop le.');
		return;
	}

	const selectedImages = countInput === 'all' ? images : images.slice(0, count);
	console.log('\nCac anh se bi xoa:');
	selectedImages.forEach((filename) => console.log(`- ${filename}`));
	const confirmation = (await ask(input, '\nXac nhan xoa? Nhap Y de dong y: ')).trim().toLowerCase();
	if (confirmation !== 'y') {
		console.log('Da huy, khong xoa anh nao.');
		return;
	}

	for (const filename of selectedImages) fs.unlinkSync(path.join(downloadFolder, filename));
	console.log(`Da xoa ${selectedImages.length} anh dau tien.`);
}

async function deleteVideos(input) {
	const videos = getDownloadedVideos();
	if (!videos.length) {
		console.log('\nThu muc Video khong co video de xoa.');
		return;
	}

	const countInput = (await ask(input, `\nCo ${videos.length} video. Nhap so video dau tien can xoa (hoac all): `)).trim().toLowerCase();
	const count = Number.parseInt(countInput, 10);
	if (countInput !== 'all' && (!Number.isInteger(count) || count < 1)) {
		console.log('So luong khong hop le.');
		return;
	}

	const selectedVideos = countInput === 'all' ? videos : videos.slice(0, count);
	console.log('\nCac video se bi xoa:');
	selectedVideos.forEach((filename) => console.log(`- ${filename}`));
	const confirmation = (await ask(input, '\nXac nhan xoa? Nhap Y de dong y: ')).trim().toLowerCase();
	if (confirmation !== 'y') {
		console.log('Da huy, khong xoa video nao.');
		return;
	}

	for (const filename of selectedVideos) fs.unlinkSync(path.join(videoFolder, filename));
	console.log(`Da xoa ${selectedVideos.length} video dau tien.`);
}

async function downloadImages(keyword, count) {
	console.log(`\nDang tim anh: ${keyword}`);
	const searchLimit = Math.min(Math.max(count * 10, 50), 200);
	const imageUrls = await findImageUrls(keyword, searchLimit);
	if (!imageUrls.length) {
		console.log('Khong tim thay URL anh nao. Google co the dang gioi han truy cap.');
		return;
	}

	fs.mkdirSync(downloadFolder, { recursive: true });
	const safeKeyword = keyword.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40) || 'anh';
	const existingFiles = fs.readdirSync(downloadFolder);
	const numberPattern = new RegExp(`^${safeKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_([0-9]+)\\.`);
	const usedNumbers = existingFiles
		.map((filename) => filename.match(numberPattern))
		.filter(Boolean)
		.map((match) => Number.parseInt(match[1], 10));
	let nextNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
	const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
	const existingHashes = new Set(existingFiles
		.filter((filename) => imageExtensions.has(path.extname(filename).toLowerCase()))
		.map((filename) => crypto.createHash('sha256')
			.update(fs.readFileSync(path.join(downloadFolder, filename)))
			.digest('hex')));
	let downloaded = 0;
	for (const [index, imageUrl] of imageUrls.entries()) {
		try {
			if (downloaded >= count) break;
			const response = await request(imageUrl, { headers: { Referer: 'https://www.bing.com/' } });
			if (!String(response.headers['content-type'] || '').startsWith('image/')) continue;
			const imageHash = crypto.createHash('sha256').update(response.body).digest('hex');
			if (existingHashes.has(imageHash)) {
				console.log(`Bo qua anh ${index + 1} (da co trong thu muc).`);
				continue;
			}
			const extension = extensionFrom(response, imageUrl);
			let filename = `${safeKeyword}_${String(nextNumber).padStart(2, '0')}${extension}`;
			while (fs.existsSync(path.join(downloadFolder, filename))) {
				nextNumber += 1;
				filename = `${safeKeyword}_${String(nextNumber).padStart(2, '0')}${extension}`;
			}
			fs.writeFileSync(path.join(downloadFolder, filename), response.body);
			existingHashes.add(imageHash);
			nextNumber += 1;
			downloaded += 1;
			console.log(`Da tai: ${filename}`);
		} catch {
			console.log(`Bo qua anh ${index + 1} (khong tai duoc).`);
		}
	}
	if (downloaded < count) {
		console.log(`Chi tim duoc ${downloaded}/${count} anh moi; cac anh trung da duoc bo qua.`);
	} else {
		console.log(`Hoan tat: ${downloaded} anh moi trong thu muc ${downloadFolder}`);
	}
}

function getDownloadedVideos() {
	if (!fs.existsSync(videoFolder)) return [];
	const videoExtensions = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi']);
	return fs.readdirSync(videoFolder)
		.filter((filename) => videoExtensions.has(path.extname(filename).toLowerCase()))
		.sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));
}

async function downloadVideos(keyword, count) {
	console.log(`\nDang tim video: ${keyword}`);
	const videoUrls = await findVideoUrls(keyword, Math.min(Math.max(count * 10, 20), 100));
	if (!videoUrls.length) {
		console.log('Khong tim thay video nao.');
		return;
	}

	fs.mkdirSync(videoFolder, { recursive: true });
	const archivePath = path.join(videoFolder, '.video-archive.txt');
	const safeKeyword = keyword.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40) || 'video';
	const downloadedBefore = new Set(getDownloadedVideos());
	let downloaded = 0;
	for (const videoUrl of videoUrls) {
		if (downloaded >= count) break;
		try {
			await runYtDlp([
				'--no-playlist',
				'--no-warnings',
				'--download-archive', archivePath,
				'-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
				'--recode-video', 'mp4',
				'-o', path.join(videoFolder, `${safeKeyword}_%(id)s.%(ext)s`),
				videoUrl,
			]);
			const currentVideos = getDownloadedVideos();
			const added = currentVideos.filter((filename) => !downloadedBefore.has(filename));
			if (added.length) {
				downloaded += added.length;
				added.forEach((filename) => downloadedBefore.add(filename));
				console.log(`Da tai: ${added.join(', ')}`);
			}
		} catch (error) {
			console.log(`Bo qua video (khong tai duoc): ${error.message.split('\n')[0]}`);
		}
	}
	if (downloaded < count) {
		console.log(`Chi tai duoc ${downloaded}/${count} video moi; video da tai se duoc bo qua.`);
	} else {
		console.log(`Hoan tat: ${downloaded} video trong thu muc ${videoFolder}`);
	}
}

function readTaiXiuState() {
	fs.mkdirSync(taiXiuDataFolder, { recursive: true });
	if (!fs.existsSync(taiXiuStatePath)) return { enabled: false, players: {}, history: [] };
	try {
		return JSON.parse(fs.readFileSync(taiXiuStatePath, 'utf8'));
	} catch {
		return { enabled: false, players: {}, history: [] };
	}
}

function writeTaiXiuState(state) {
	fs.mkdirSync(taiXiuDataFolder, { recursive: true });
	fs.writeFileSync(taiXiuStatePath, `${JSON.stringify(state, null, 2)}\n`);
}

function printTaiXiuHelp() {
	console.log('\n=== TAI XIU MO PHONG ===');
	console.log('Chi choi vui, khong tien that.');
	console.log('node c.js /txglobal on');
	console.log('node c.js /txglobal set <so_tien>');
	console.log('node c.js /txglobal check');
	console.log('node c.js /txglobal tai <so_tien|all>');
	console.log('node c.js /txglobal xiu <so_tien|all>');
	console.log('node c.js /txglobal off');
}

function runTaiXiuCommand(command) {
	const state = readTaiXiuState();
	const action = (command[0] || 'help').toLowerCase();
	const playerId = 'local';
	const currentBalance = Number(state.players[playerId] || 0);

	if (action === 'help') {
		printTaiXiuHelp();
		return;
	}
	if (action === 'on' || action === 'off') {
		state.enabled = action === 'on';
		writeTaiXiuState(state);
		console.log(`Da ${state.enabled ? 'bat' : 'tat'} ban tai xiu.`);
		return;
	}
	if (action === 'check') {
		console.log(`So du nguoi choi local: ${currentBalance.toLocaleString('vi-VN')} VND`);
		return;
	}
	if (action === 'set') {
		const amount = Number(command[1]);
		if (!Number.isSafeInteger(amount) || amount <= 0) {
			console.log('So tien nap phai la so nguyen duong.');
			return;
		}
		state.players[playerId] = currentBalance + amount;
		writeTaiXiuState(state);
		console.log(`Da nap ${amount.toLocaleString('vi-VN')} VND. So du: ${state.players[playerId].toLocaleString('vi-VN')} VND`);
		return;
	}
	if (!['tai', 'xiu'].includes(action)) {
		printTaiXiuHelp();
		return;
	}
	if (!state.enabled) {
		console.log('Ban tai xiu dang tat. Hay dung /txglobal on truoc.');
		return;
	}
	const amount = command[1] === 'all' ? currentBalance : Number(command[1]);
	if (!Number.isSafeInteger(amount) || amount < 1000) {
		console.log('Tien cuoc phai la so nguyen tu 1.000 VND tro len.');
		return;
	}
	if (amount > currentBalance) {
		console.log(`Khong du tien. So du hien tai: ${currentBalance.toLocaleString('vi-VN')} VND`);
		return;
	}

	const dice = [crypto.randomInt(1, 7), crypto.randomInt(1, 7), crypto.randomInt(1, 7)];
	const total = dice.reduce((sum, value) => sum + value, 0);
	const triple = dice[0] === dice[1] && dice[1] === dice[2];
	const result = total >= 11 ? 'tai' : 'xiu';
	const multiplier = triple && [1, 6].includes(dice[0]) ? 5 : 1;
	const won = action === result;
	const change = won ? amount * multiplier : -amount;
	state.players[playerId] = currentBalance + change;
	state.history.push({ dice, total, result, choice: action, amount, time: new Date().toISOString() });
	state.history = state.history.slice(-20);
	writeTaiXiuState(state);
	console.log(`Xuc xac: [${dice.join(' - ')}] | Tong: ${total}`);
	console.log(`Ket qua: ${result.toUpperCase()}${triple ? ` (bo ba, x${multiplier})` : ''}`);
	console.log(won ? `Ban thang ${(amount * multiplier).toLocaleString('vi-VN')} VND!` : `Ban thua ${amount.toLocaleString('vi-VN')} VND.`);
	console.log(`So du: ${state.players[playerId].toLocaleString('vi-VN')} VND`);
}

async function main() {
	const input = readline.createInterface({ input: process.stdin, output: process.stdout });
	const command = process.argv.slice(2).map((argument) => argument.toLowerCase());
	if (command.some((item) => ['taixiu', 'tai-xiu', 'tx', '/tx', 'txglobal', '/txglobal'].includes(item))) {
		runTaiXiuCommand(command.slice(command.findIndex((item) => ['taixiu', 'tai-xiu', 'tx', '/tx', 'txglobal', '/txglobal'].includes(item)) + 1));
		input.close();
		return;
	}
	if (command.includes('reset-video')) {
		await deleteVideos(input);
		input.close();
		return;
	}
	if (command.includes('reset')) {
		await deleteImages(input);
		input.close();
		return;
	}
	console.log('\n=== TOOLS TIM ANH / VIDEO ===');
	console.log('1. Tim va tai anh');
	console.log('2. Tim va tai video');
	console.log('3. Xoa anh dau tien');
	console.log('4. Xoa video dau tien');
	console.log('5. Choi tai xiu');
	console.log('0. Thoat');

	const choice = (await ask(input, '\nChon chuc nang: ')).trim();
	if (choice === '0') {
		input.close();
		return;
	}
	if (choice === '5' || ['tx', '/tx', 'taixiu', 'tai-xiu'].includes(choice.toLowerCase())) {
		printTaiXiuHelp();
		input.close();
		return;
	}
	if (choice === '3') {
		await deleteImages(input);
		input.close();
		return;
	}
	if (choice === '4') {
		await deleteVideos(input);
		input.close();
		return;
	}
	const keyword = (await ask(input, 'Nhap ten muon tim: ')).trim();
	if (!keyword) {
		input.close();
		console.log('Ban chua nhap tu khoa.');
		return;
	}

	if (choice === '1') {
		const countInput = (await ask(input, 'Nhap so luong anh can tai (1-50, mac dinh 10): ')).trim();
		const parsedCount = Number.parseInt(countInput, 10);
		const count = Number.isNaN(parsedCount) ? 10 : Math.min(Math.max(parsedCount, 1), 50);
		input.close();
		try {
			await downloadImages(keyword, count);
		} catch (error) {
			console.error(`\nTim anh that bai: ${error.message}`);
		}
	} else if (choice === '2') {
		const countInput = (await ask(input, 'Nhap so luong video can tai (1-20, mac dinh 1): ')).trim();
		const parsedCount = Number.parseInt(countInput, 10);
		const count = Number.isNaN(parsedCount) ? 1 : Math.min(Math.max(parsedCount, 1), 20);
		input.close();
		try {
			await downloadVideos(keyword, count);
		} catch (error) {
			console.error(`\nTim video that bai: ${error.message}`);
		}
	} else {
		console.log('Lua chon khong hop le.');
	}
}

main();


