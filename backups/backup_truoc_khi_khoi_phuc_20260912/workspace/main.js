// Tự động khởi tạo hiệu ứng Sparkle Particles trên UI
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('particles');
  const particleCount = 18;
  const colors = ['#00f2fe', '#7928ca', '#ff0080', '#00ff88'];

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 8 + 4;
    const color = colors[Math.floor(Math.random() * colors.length)];

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 10px ${color}`;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 2}s`;
    particle.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;

    container.appendChild(particle);
  }

  // Xử lý sự kiện gửi tin nhắn
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  function sendMessage() {
    const text = userInput.value.trim();
    if (text) {
      console.log('User prompt:', text);
      userInput.value = '';
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
});
