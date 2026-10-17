const net = require('net');

/**
 * Kiểm tra trạng thái của một cổng TCP đơn lẻ.
 * @param {string} host Địa chỉ IP hoặc hostname mục tiêu.
 * @param {number} port Số cổng TCP cần kiểm tra.
 * @param {number} timeout Thời gian chờ (ms).
 * @returns {Promise<boolean>} Trả về true nếu cổng mở, false nếu đóng hoặc lỗi.
 */
function checkPort(host, port, timeout = 1000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = false;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            status = true;
            socket.destroy();
        });

        socket.on('timeout', () => {
            socket.destroy();
        });

        socket.on('error', () => {
            socket.destroy();
        });

        socket.on('close', () => {
            resolve(status);
        });

        socket.connect(port, host);
    });
}

/**
 * Quét một dải cổng TCP với giới hạn số luồng (concurrency limit).
 * @param {string} host Địa chỉ IP hoặc hostname mục tiêu.
 * @param {number} startPort Cổng bắt đầu.
 * @param {number} endPort Cổng kết thúc.
 * @param {number} concurrency Số lượng kết nối đồng thời tối đa.
 * @param {number} timeout Thời gian timeout mỗi cổng (ms).
 * @returns {Promise<number[]>} Danh sách các cổng đang mở.
 */
async function scanPorts(host, startPort = 1, endPort = 1024, concurrency = 50, timeout = 1000) {
    const openPorts = [];
    const ports = [];

    for (let p = startPort; p <= endPort; p++) {
        ports.push(p);
    }

    let index = 0;

    async function worker() {
        while (index < ports.length) {
            const currentPort = ports[index++];
            const isOpen = await checkPort(host, currentPort, timeout);
            if (isOpen) {
                openPorts.push(currentPort);
                console.log(`[+] Cổng ${currentPort} đang MỞ`);
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, ports.length); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return openPorts.sort((a, b) => a - b);
}

module.exports = {
    checkPort,
    scanPorts
};

// Cho phép thực thi độc lập từ terminal: node scanner.js [host] [startPort] [endPort]
if (require.main === module) {
    const host = process.argv[2] || '127.0.0.1';
    const startPort = parseInt(process.argv[3], 10) || 1;
    const endPort = parseInt(process.argv[4], 10) || 1024;

    console.log(`[*] Bắt đầu quét host: ${host} (cổng ${startPort} -> ${endPort})...`);
    const startTime = Date.now();

    scanPorts(host, startPort, endPort, 50, 800)
        .then((openPorts) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log('----------------------------------------');
            console.log(`[*] Quét hoàn tất trong ${duration}s. Các cổng đang mở:`, openPorts);
        })
        .catch((err) => {
            console.error('[-] Lỗi trong quá trình quét:', err);
        });
}
