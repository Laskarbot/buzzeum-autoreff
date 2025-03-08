const axios = require('axios');
const fs = require('fs');
const ethers = require('ethers');
const readline = require('readline');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');

// Membuat antarmuka untuk input dari pengguna
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Fungsi untuk bertanya kepada pengguna
const askQuestion = (question) => {
    return new Promise((resolve) => rl.question(question, resolve));
};

// Fungsi untuk menunggu selama 10 detik
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk membaca proxy dari file proxy.txt
const getProxy = () => {
    try {
        const proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(line => line.trim() !== '');
        if (proxies.length === 0) return null;
        const proxy = proxies[Math.floor(Math.random() * proxies.length)].trim();
        return proxy;
    } catch (error) {
        console.error('Error membaca file proxy.txt:', error);
        return null;
    }
};

// Fungsi untuk menambahkan proxy ke permintaan Axios jika ada
const getAxiosInstance = (proxy) => {
    const instance = axios.create();

    if (proxy) {
        const agent = proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new https.Agent({ 
            proxy: {
                host: proxy.split(':')[0],
                port: parseInt(proxy.split(':')[1], 10)
            }
        });

        instance.defaults.httpsAgent = agent;
    }

    return instance;
};

// Fungsi untuk membuat wallet Ethereum secara otomatis
const generateWallet = () => {
    try {
        const wallet = ethers.Wallet.createRandom();
        const provider = new ethers.JsonRpcProvider();  // Gunakan provider default
        const signer = wallet.connect(provider);  // Menghubungkan wallet dengan provider sebagai signer

        console.log(`Wallet Ethereum dibuat: ${wallet.address}`);
        return { wallet, signer };
    } catch (error) {
        console.error('Error saat membuat wallet:', error);
    }
};

// Fungsi untuk menandatangani pesan dengan wallet
const signMessage = async (signer, message) => {
    try {
        console.log('Menandatangani pesan...');
        return await signer.signMessage(message);
    } catch (error) {
        console.error('Error saat menandatangani pesan:', error);
    }
};

// Fungsi untuk mendapatkan pesan dari API untuk tanda tangan
const getSignMessage = async (walletAddress) => {
    try {
        console.log(`Mengambil pesan untuk wallet ${walletAddress}...`);
        const response = await axios.get(`https://api.x.ink/v1/get-sign-message2?walletAddress=${walletAddress}`);
        return response.data;
    } catch (error) {
        console.error('Gagal mendapatkan pesan tanda tangan:', error);
    }
};

// Fungsi untuk pendaftaran dengan wallet
const registerWithWallet = async (wallet, invitedBy = "", axiosInstance) => {
    try {
        console.log(`Mendaftar dengan wallet ${wallet.address}...`);
        const payload = {
            address: wallet.address,
            invited_by: invitedBy // Referral code atau bagian lainnya bisa ditambahkan di sini
        };

        const response = await axiosInstance.post('https://airdrop.buzzeum.space/server.php', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
        });

        if (response.data.success) {
            console.log('Pendaftaran berhasil!');
            return response.data.message;
        } else {
            console.log('Pendaftaran gagal:', response.data.message);
            return null;
        }
    } catch (error) {
        console.error('Gagal melakukan pendaftaran:', error);
        return null;
    }
};

// Fungsi untuk claim daily drops
const claimDailyDrops = async (wallet, signature, axiosInstance) => {
    try {
        console.log('Melakukan klaim daily drops...');
        const payload = {
            uad: wallet.address,  // Menggunakan alamat wallet sebagai uad
            sgn: signature         // Menggunakan signature untuk klaim
        };

        const response = await axiosInstance.post('https://airdrop.buzzeum.space/claimDrops.php', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
        });

        // Hanya menampilkan success, amount, dan referral
        if (response.data.success) {
            console.log('Klaim drops berhasil!');
            console.log(`Amount: ${response.data.amount}`);
            console.log(`Referral: ${response.data.referral ? 'Berhasil' : 'Gagal'}`);
            return response.data.message;
        } else {
            console.log('Klaim drops gagal:', response.data.message);
            return null;
        }
    } catch (error) {
        console.error('Gagal melakukan klaim drops:', error);
        return null;
    }
};

// Fungsi untuk verifikasi tweet
const verifyTweet = async (userId, taskId, axiosInstance) => {
    try {
        console.log('Melakukan verifikasi tweet...');
        const payload = {
            tweet_id: "",
            user_id: userId,
            task_id: taskId,
            rew: "500"
        };

        const response = await axiosInstance.post('https://airdrop.buzzeum.space/verify_tweet.php', payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
        });

        if (response.data.success) {
            console.log('Verifikasi tweet berhasil!');
            console.log(`Reward yang diterima: ${response.data.reward || '0'}`);
        } else {
            console.log('Verifikasi tweet gagal:', response.data.message);
        }
    } catch (error) {
        console.error('Gagal melakukan verifikasi tweet:', error);
    }
};

// Fungsi untuk menjalankan pembuatan akun dan klaim drops
const processRegistrationAndClaim = async (invitedBy = "", axiosInstance) => {
    try {
        const { wallet, signer } = generateWallet();
        if (!wallet || !signer) return;

        // Proses pendaftaran
        console.log('Mendaftar dengan wallet...');
        const registerMessage = await registerWithWallet(wallet, invitedBy, axiosInstance);
        if (!registerMessage) return;

        // Mendapatkan pesan untuk tanda tangan
        const signMessageData = await getSignMessage(wallet.address);
        if (!signMessageData || !signMessageData.message) {
            console.log('Tidak ada pesan untuk ditandatangani.');
            return;
        }

        // Menandatangani pesan dengan wallet
        const signature = await signMessage(signer, signMessageData.message);

        // Klaim daily drops menggunakan tanda tangan
        const claimMessage = await claimDailyDrops(wallet, signature, axiosInstance);
        if (claimMessage) {
            console.log('Auto-claim daily berhasil!');
            await fs.promises.appendFile('daily_claim_success.txt', `${wallet.address}: ${claimMessage}\n`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Terjadi kesalahan dalam proses pendaftaran, login, dan klaim:', error);
        return false;
    }
};

// Fungsi untuk menjalankan proses pembuatan akun secara berurutan
const runAccountCreation = async () => {
    try {
        // Menanyakan jumlah akun yang ingin dibuat
        const numAccounts = parseInt(await askQuestion('Berapa akun yang ingin dibuat? '), 10);

        // Menanyakan kode referral
        const referralCode = await askQuestion('Masukkan kode referral Anda: ');

        let successfulAccounts = 0; // Variabel untuk menghitung akun yang berhasil dibuat

        // Proses pembuatan akun
        for (let i = 0; i < numAccounts; i++) {
            console.log(`\nMemulai pembuatan akun ${i + 1}...`);
            
            // Ambil proxy jika ada
            const proxy = getProxy();
            const axiosInstance = getAxiosInstance(proxy);
            
            const success = await processRegistrationAndClaim(referralCode, axiosInstance);

            // Cek apakah pendaftaran berhasil
            if (success) {
                successfulAccounts++;
            }

            // Menunggu 10 detik sebelum membuat akun berikutnya
            if (i < numAccounts - 1) {
                console.log('Menunggu 10 detik sebelum membuat akun berikutnya...');
                await delay(10000); // Menunggu selama 10 detik
            }
        }

        // Menampilkan total akun yang berhasil dibuat
        console.log(`\nProses selesai! Total akun yang berhasil dibuat: ${successfulAccounts}/${numAccounts}`);
        rl.close();
    } catch (error) {
        console.error('Terjadi kesalahan dalam pembuatan akun:', error);
        rl.close();
    }
};

// Menjalankan skrip
runAccountCreation();
