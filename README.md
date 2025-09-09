1. Event Listener Utama (client.on(event,callback))\

message
Menangkap setiap pesan masuk.

message_create
Menangkap pesan yang kamu kirim (dari bot).

message_ack
Status pesan: terkirim ✓, diterima ✓✓, dibaca ✓✓ biru.

ready
Bot aktif

authenticated
Login berhasil.

auth_failure
Login gagal. Biasanya session corrupt.

disconnected
Terputus dari WA Web.

qr
QR code untuk login (sekali saja saat pertama kali scan).

change_state
Status koneksi berubah (CONNECTED, DISCONNECTED, dll).

group_join
Ada member baru masuk grup.

group_leave
Ada member keluar grup.

group_update
Perubahan setting grup (nama, deskripsi, dsb).

presence_update
Update status online/typing seseorang.

media_uploaded
File media sudah selesai di-upload.


🔹 2. Method Utama Client

client.initialize() → start bot.

client.destroy() → stop bot.

client.sendMessage(to, content, options) → kirim pesan.

client.getChats() → ambil semua chat.

client.getChatById(id) → ambil satu chat spesifik.

client.getContacts() → ambil semua kontak.

client.getNumberId(number) → cek nomor valid atau tidak.

client.getState() → cek state bot.


🔹 3. Objek Message
Objek msg yang kamu terima di event "message" punya fungsi:

msg.reply("teks") → balas pesan langsung.

msg.getChat() → ambil info chat.

msg.getContact() → ambil info pengirim.

msg.downloadMedia() → download media yang dikirim.

msg.forward(to) → forward pesan.

msg.delete() → hapus pesan.

🔹 4. Objek Chat
Dari await msg.getChat() atau client.getChatById(id):

chat.sendMessage("halo")

chat.isGroup → cek apakah grup.

chat.participants → list peserta grup.

chat.setSubject("judul baru") → ganti nama grup.

chat.setDescription("deskripsi baru")

chat.clearMessages() → hapus semua pesan.

chat.leave() → keluar dari grup.

🔹 5. Objek Contact
Dari await msg.getContact():

contact.id → nomor WA.

contact.pushname → nama WA.

contact.isBusiness → akun bisnis atau tidak.

contact.getProfilePicUrl() → ambil foto profil.

disini aku bikin bot yang menjawab membantu ku menjawab orang lain ketika aku sedang offline. tp karena tidak ada fungsi untuk memastikan aku sedang offline, maka aku bikin fungsi sendiri, yaitu ketika nomer yang sudah ditentukan memberikan command @aktif, maka bot akan aktif dan merespon ketika ada orang lain yang ngechat aku (blm aku beri fungsi ketika ditelpon, bot respon nya bagaimana). yang ini hanya auto reply, untuk berbicara dengan bot, kita ada trigger lagi. mirip seperti meta, bedanya dia akan trs hidup hingga dia di suruh mati.