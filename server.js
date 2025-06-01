const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const moment = require('moment');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'invitations.json');
const REDIS_KEY = 'wedding-invitations';

// Redis configuration
let redisClient = null;
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING || "redis://default:PaayJBWLRrOEyDnD3TAMlsdkEiI5bA1k@redis-18294.c292.ap-southeast-1-1.ec2.redns.redis-cloud.com:18294";

// Initialize Redis client if available
if (REDIS_URL) {
    try {
        redisClient = new Redis(REDIS_URL);
        console.log(`[REDIS] Connecting to Redis server...`);
        
        redisClient.on('connect', () => {
            console.log('[REDIS] Connected to Redis server');
        });
        
        redisClient.on('error', (err) => {
            console.error('[REDIS] Redis connection error:', err);
        });
    } catch (error) {
        console.error('[REDIS] Failed to initialize Redis:', error);
        redisClient = null;
    }
}

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
    // Skip on serverless/production environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
        console.log('[INIT] Skipping data directory creation on serverless environment');
        return;
    }
    
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        console.log('[INIT] Data directory created/verified');
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Initialize empty JSON file if it doesn't exist
async function initDataFile() {
    // Skip on serverless/production environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
        console.log('[INIT] Skipping data file initialization on serverless environment');
        return;
    }
    
    try {
        await fs.access(DATA_FILE);
        console.log('[INIT] Data file exists');
    } catch {
        try {
            await fs.writeFile(DATA_FILE, '[]');
            console.log('[INIT] Data file created');
        } catch (error) {
            console.error('Error creating data file:', error);
        }
    }
}

// Data operations functions
async function readInvitations() {
    // Priority: Custom Redis > Local File
    if (redisClient) {
        try {
            console.log('[REDIS] Reading invitations from Redis');
            const data = await redisClient.get(REDIS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[REDIS] Error reading from Redis:', error);
            // Fallback to file if Redis fails
        }
    }
    
    // Fallback to local file
    try {
        console.log('[FILE] Reading invitations from file');
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[FILE] Error reading from file:', error);
        return [];
    }
}

async function writeInvitations(invitations) {
    // Priority: Custom Redis > Local File
    if (redisClient) {
        try {
            console.log(`[REDIS] Writing ${invitations.length} invitations to Redis`);
            await redisClient.set(REDIS_KEY, JSON.stringify(invitations));
            return true;
        } catch (error) {
            console.error('[REDIS] Error writing to Redis:', error);
            throw error;
        }
    }
    
    // Fallback to local file
    try {
        console.log(`[FILE] Writing ${invitations.length} invitations to file`);
        await fs.writeFile(DATA_FILE, JSON.stringify(invitations, null, 2));
        return true;
    } catch (error) {
        console.error('[FILE] Error writing to file:', error);
        throw error;
    }
}

// Main wedding page route
app.get('/', async (req, res) => {
    try {
        const invitations = await readInvitations();
        // Get 4 most recent invitations
        const recentInvitations = invitations
            .sort((a, b) => new Date(b.created) - new Date(a.created))
            .slice(0, 4);
        
        res.render('home', { 
            title: 'Đám cưới Minh Đức & Ngọc Ánh',
            recentInvitations,
            invitation: null,
            layout: 'layout'
        });
    } catch (error) {
        console.error('Error reading invitations:', error);
        // If error, show empty state
        res.render('home', { 
            title: 'Đám cưới Minh Đức & Ngọc Ánh',
            recentInvitations: [],
            invitation: null,
            layout: 'layout'
        });
    }
});

// Home page with invitation ID route
app.get('/home/:id', async (req, res) => {
    try {
        const invitations = await readInvitations();
        const invitation = invitations.find(inv => inv.id === req.params.id);
        
        if (invitation) {
            res.render('home', { 
                title: 'Đám cưới Minh Đức & Ngọc Ánh',
                recentInvitations: [],
                invitation,
                layout: 'layout'
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
        // If error, show 404
        res.status(404).render('error', { 
            title: 'Không tìm thấy - Đám cưới Minh Đức & Ngọc Ánh',
            message: 'Không tìm thấy thư mời',
            error: { status: 404 },
            layout: 'layout'
        });
    }
});

// Admin page route
app.get('/admin', async (req, res) => {
    try {
        const invitations = await readInvitations();
        res.render('admin/index', { 
            title: 'Quản lý Thư mời - Đám cưới Minh Đức & Ngọc Ánh',
            invitations,
            layout: 'layout'
        });
    } catch (error) {
        console.error('Error reading invitations:', error);
        // If error, show empty list
        res.render('admin/index', { 
            title: 'Quản lý Thư mời - Đám cưới Minh Đức & Ngọc Ánh',
            invitations: [],
            layout: 'layout',
            messages: {
                error: 'Có lỗi xảy ra khi tải dữ liệu'
            }
        });
    }
});

// Create invitation route
app.post('/admin/invitations', async (req, res) => {
    try {
        const invitations = await readInvitations();
        
        const newInvitation = {
            id: Math.random().toString(36).substr(2, 9),
            title: req.body.title,
            from: req.body.from,
            created: new Date().toISOString()
        };
        
        invitations.push(newInvitation);
        await writeInvitations(invitations);
        
        res.redirect('/admin?success=Tạo thư mời thành công');
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi tạo thư mời');
    }
});

// Update invitation route
app.put('/admin/invitations/:id', async (req, res) => {
    try {
        const invitations = await readInvitations();
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
        
        await writeInvitations(invitations);
        
        res.redirect('/admin?success=Cập nhật thư mời thành công');
    } catch (error) {
        console.error('Error updating invitation:', error);
        res.redirect('/admin?error=Có lỗi xảy ra khi cập nhật thư mời');
    }
});

// Delete invitation route
app.delete('/admin/invitations/:id', async (req, res) => {
    try {
        const invitations = await readInvitations();
        const index = invitations.findIndex(inv => inv.id === req.params.id);
        
        if (index === -1) {
            // Check if request expects JSON response
            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(404).json({ error: 'Không tìm thấy thư mời' });
            }
            return res.redirect('/admin?error=Không tìm thấy thư mời');
        }
        
        invitations.splice(index, 1);
        await writeInvitations(invitations);
        
        // Check if request expects JSON response
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.json({ success: 'Xóa thư mời thành công' });
        }
        
        res.redirect('/admin?success=Xóa thư mời thành công');
    } catch (error) {
        console.error('Error deleting invitation:', error);
        
        // Check if request expects JSON response
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({ 
                error: 'Có lỗi xảy ra khi xóa thư mời'
            });
        }
        res.redirect('/admin?error=Có lỗi xảy ra khi xóa thư mời');
    }
});

// Individual invitation page route  
app.get('/invitation/:id', async (req, res) => {
    try {
        const invitations = await readInvitations();
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
        res.status(404).render('error', { 
            title: 'Không tìm thấy - Đám cưới Minh Đức & Ngọc Ánh',
            message: 'Không tìm thấy thư mời',
            error: { status: 404 },
            layout: 'layout'
        });
    }
});

// API endpoint for invitation data (if needed for AJAX)
app.get('/api/invitations/:id', async (req, res) => {
    try {
        const invitations = await readInvitations();
        const invitation = invitations.find(inv => inv.id === req.params.id);
        
        if (!invitation) {
            return res.status(404).json({ error: 'Không tìm thấy thư mời' });
        }

        res.json(invitation);
    } catch (error) {
        console.error('Error reading invitation:', error);
        res.status(404).json({ error: 'Không tìm thấy thư mời' });
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