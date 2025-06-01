const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'invitations.json');

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Initialize empty JSON file if it doesn't exist
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, '[]');
    }
}

// Get all invitations
app.get('/api/invitations', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading invitations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single invitation by ID
app.get('/api/invitations/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const invitation = invitations.find(inv => inv.id === req.params.id);
        
        if (invitation) {
            res.json(invitation);
        } else {
            res.status(404).json({ error: 'Invitation not found' });
        }
    } catch (error) {
        console.error('Error reading invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new invitation
app.post('/api/invitations', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const newInvitation = req.body;
        
        invitations.push(newInvitation);
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        
        res.status(201).json(newInvitation);
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete invitation
app.delete('/api/invitations/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const index = invitations.findIndex(inv => inv.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Invitation not found' });
        }
        
        invitations.splice(index, 1);
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        
        res.status(200).json({ message: 'Invitation deleted successfully' });
    } catch (error) {
        console.error('Error deleting invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize server
async function init() {
    await ensureDataDir();
    await initDataFile();
    
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

init(); 