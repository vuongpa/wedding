const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'invitations.json');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// Local variables middleware
app.use((req, res, next) => {
    res.locals.baseUrl = `${req.protocol}://${req.get('host')}`;
    res.locals.moment = moment;
    res.locals.messages = {
        success: req.query.success,
        error: req.query.error
    };
    next();
});

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

// Main wedding page route
app.get('/', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        // Get 4 most recent invitations
        const recentInvitations = invitations
            .sort((a, b) => new Date(b.created) - new Date(a.created))
            .slice(0, 4);
        
        res.render('home', { 
            title: 'Đám cưới Minh Đức & Ngọc Ánh',
            recentInvitations,
            layout: 'layout'
        });
    } catch (error) {
        console.error('Error reading invitations:', error);
        res.status(500).render('error', { 
            title: 'Lỗi - Đám cưới Minh Đức & Ngọc Ánh',
            message: 'Có lỗi xảy ra',
            error: { status: 500 }
        });
    }
});

// Admin page route
app.get('/admin', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        res.render('admin/index', { 
            title: 'Quản lý Thư mời - Đám cưới Minh Đức & Ngọc Ánh',
            invitations,
            layout: 'layout'
        });
    } catch (error) {
        console.error('Error reading invitations:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi tải danh sách thư mời');
    }
});

// Create invitation route
app.post('/admin/invitations', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const newInvitation = {
            id: Math.random().toString(36).substr(2, 9),
            title: req.body.title,
            from: req.body.from,
            created: new Date().toISOString()
        };
        
        invitations.push(newInvitation);
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        
        res.redirect('/admin?success=Tạo thư mời thành công');
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi tạo thư mời');
    }
});

// Update invitation route
app.put('/admin/invitations/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const index = invitations.findIndex(inv => inv.id === req.params.id);
        
        if (index === -1) {
            return res.redirect('/admin?error=Không tìm thấy thư mời');
        }
        
        // Keep original created date and id
        invitations[index] = {
            ...invitations[index],
            title: req.body.title,
            from: req.body.from,
            updated: new Date().toISOString()
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        
        res.redirect('/admin?success=Cập nhật thư mời thành công');
    } catch (error) {
        console.error('Error updating invitation:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi cập nhật thư mời');
    }
});

// Delete invitation route
app.delete('/admin/invitations/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const index = invitations.findIndex(inv => inv.id === req.params.id);
        
        if (index === -1) {
            return res.redirect('/admin?error=Không tìm thấy thư mời');
        }
        
        invitations.splice(index, 1);
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        
        res.redirect('/admin?success=Xóa thư mời thành công');
    } catch (error) {
        console.error('Error deleting invitation:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi xóa thư mời');
    }
});

// Individual invitation page route  
app.get('/invitation/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const invitation = invitations.find(inv => inv.id === req.params.id);
        
        if (invitation) {
            res.render('invitation', { 
                invitation,
                layout: false // Disable layout for invitation page
            });
        } else {
            res.status(404).render('error', { 
                title: 'Không tìm thấy - Đám cưới Minh Đức & Ngọc Ánh',
                message: 'Không tìm thấy thư mời',
                error: { status: 404 },
                layout: 'layout'
            });
        }
    } catch (error) {
        console.error('Error reading invitation:', error);
        res.status(500).render('error', { 
            title: 'Lỗi - Đám cưới Minh Đức & Ngọc Ánh',
            message: 'Có lỗi xảy ra',
            error: { status: 500 },
            layout: 'layout'
        });
    }
});

// API endpoint for invitation data (if needed for AJAX)
app.get('/api/invitations/:id', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const invitations = JSON.parse(data);
        const invitation = invitations.find(inv => inv.id === req.params.id);
        
        if (!invitation) {
            return res.status(404).json({ error: 'Không tìm thấy thư mời' });
        }

        res.json(invitation);
    } catch (error) {
        console.error('Error reading invitation:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra' });
    }
});

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Trang không tồn tại - Đám cưới Minh Đức & Ngọc Ánh',
        message: 'Trang không tồn tại',
        error: { status: 404 },
        layout: 'layout'
    });
});

// Initialize server
async function init() {
    await ensureDataDir();
    await initDataFile();
    
    app.listen(PORT, () => {
        console.log(`🎉 Wedding Invitation Server is running on http://localhost:${PORT}`);
        console.log(`📝 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`💒 Main site: http://localhost:${PORT}/`);
    });
}

init(); 