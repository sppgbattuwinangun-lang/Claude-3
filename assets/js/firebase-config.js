// Firebase Configuration for SPPG
// Using Firebase Realtime Database for multi-device sync

const firebaseConfig = {
    apiKey: "AIzaSyD_placeholder_SPPG_key",
    authDomain: "sppg-battuwinangun.firebaseapp.com",
    databaseURL: "https://sppg-battuwinangun-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sppg-battuwinangun",
    storageBucket: "sppg-battuwinangun.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:placeholder"
};

// NOTE: Karena ini static hosting (GitHub Pages), kita gunakan localStorage + BroadcastChannel
// untuk sinkronisasi antar tab, dan JSON export/import untuk sinkronisasi antar device.
// Untuk produksi penuh, ganti dengan Firebase Realtime Database yang sudah dikonfigurasi.

// ===== LOCAL STORAGE DATABASE ENGINE =====
class SPPGDatabase {
    constructor() {
        this.storagePrefix = 'sppg_';
        this.listeners = {};
        this.channel = null;
        this.initBroadcast();
    }

    initBroadcast() {
        try {
            this.channel = new BroadcastChannel('sppg_sync');
            this.channel.onmessage = (event) => {
                const { type, collection, data } = event.data;
                if (type === 'update') {
                    this.notifyListeners(collection, data);
                }
            };
        } catch (e) {
            console.log('BroadcastChannel not supported');
        }
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Get collection
    getCollection(name) {
        const key = this.storagePrefix + name;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    // Save collection
    saveCollection(name, data) {
        const key = this.storagePrefix + name;
        localStorage.setItem(key, JSON.stringify(data));
        this.broadcast('update', name, data);
        this.notifyListeners(name, data);
    }

    // Add item to collection
    add(collection, item) {
        const data = this.getCollection(collection);
        item.id = this.generateId();
        item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        data.push(item);
        this.saveCollection(collection, data);
        this.logActivity('add', collection, item);
        return item;
    }

    // Update item in collection
    update(collection, id, updates) {
        const data = this.getCollection(collection);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveCollection(collection, data);
            this.logActivity('edit', collection, data[index]);
            return data[index];
        }
        return null;
    }

    // Delete item from collection
    delete(collection, id) {
        const data = this.getCollection(collection);
        const item = data.find(item => item.id === id);
        const filtered = data.filter(item => item.id !== id);
        this.saveCollection(collection, filtered);
        if (item) this.logActivity('delete', collection, item);
        return true;
    }

    // Get single item
    getById(collection, id) {
        const data = this.getCollection(collection);
        return data.find(item => item.id === id) || null;
    }

    // Log activity
    logActivity(action, collection, item) {
        const activities = this.getCollection('activities');
        const activity = {
            id: this.generateId(),
            action,
            collection,
            itemName: item.nama || item.noNota || item.id,
            timestamp: new Date().toISOString()
        };
        activities.unshift(activity);
        // Keep only last 50 activities
        if (activities.length > 50) activities.length = 50;
        const key = this.storagePrefix + 'activities';
        localStorage.setItem(key, JSON.stringify(activities));
    }

    // Listen to changes
    onCollectionChange(collection, callback) {
        if (!this.listeners[collection]) {
            this.listeners[collection] = [];
        }
        this.listeners[collection].push(callback);
    }

    notifyListeners(collection, data) {
        if (this.listeners[collection]) {
            this.listeners[collection].forEach(cb => cb(data));
        }
    }

    broadcast(type, collection, data) {
        if (this.channel) {
            this.channel.postMessage({ type, collection, data });
        }
    }

    // Export all data as JSON
    exportAll() {
        const exported = {
            penerima: this.getCollection('penerima'),
            nota: this.getCollection('nota'),
            activities: this.getCollection('activities'),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(exported, null, 2);
    }

    // Import data from JSON
    importAll(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.penerima) this.saveCollection('penerima', data.penerima);
            if (data.nota) this.saveCollection('nota', data.nota);
            if (data.activities) this.saveCollection('activities', data.activities);
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    }

    // Get stats
    getStats() {
        const penerima = this.getCollection('penerima');
        const nota = this.getCollection('nota');
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        return {
            totalPenerima: penerima.filter(p => p.statusAktif).length,
            totalNotaToday: nota.filter(n => n.tanggal === today).length,
            pendingNota: nota.filter(n => n.status === 'pending').length,
            completedThisMonth: nota.filter(n => n.status === 'completed' && n.tanggal && n.tanggal.startsWith(thisMonth)).length
        };
    }
}

// Initialize database
window.db = new SPPGDatabase();

// Seed initial data if empty
if (window.db.getCollection('penerima').length === 0) {
    window.db.add('penerima', {
        nik: '3209376507960002',
        nama: 'MIANA',
        tanggalLahir: '1996-07-25',
        jenisKelamin: 'P',
        namaOrtu: '-',
        posisi: '1',
        statusAktif: true
    });
}

// Admin credentials (in production, use Firebase Auth)
window.ADMIN_USERS = [
    { username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
    { username: 'operator', password: 'operator123', name: 'Operator', role: 'operator' }
];

export default window.db;
