document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    // Tự động điều chỉnh chiều cao textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    function addMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-brain"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        if (isUser) {
            contentDiv.textContent = text;
        } else {
            // Giả lập luồng tư duy 3 tầng của Thức Thinking Pro
            contentDiv.innerHTML = `
                <p><strong>[PHÂN TÍCH GỐC RỄ & KIẾN TRÚC]:</strong> Tiếp nhận yêu cầu: "${text}"</p>
                <p style="margin-top: 8px;">Hệ thống đang tiến hành xử lý logic đa tầng, tối ưu hóa thuật toán và cấu trúc mã nguồn chuẩn Production độc quyền bởi <strong>THỨC</strong>.</p>
            `;
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, true);
        userInput.value = '';
        userInput.style.height = 'auto';

        // Phản hồi giả lập từ Siêu Trí Tuệ Thức Thinking Pro sau 1 giây
        setTimeout(() => {
            addMessage(text, false);
        }, 1000);
    }

    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
});
