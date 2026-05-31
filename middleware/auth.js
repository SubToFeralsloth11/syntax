function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  if (req.user.banned_until) {
    const banEnd = new Date(req.user.banned_until);
    if (banEnd > new Date()) {
      req.flash('error', 'Your account has been suspended until ' + banEnd.toLocaleString());
      req.logout(() => {});
      return res.redirect('/login');
    }
  }
  next();
}

function forwardAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth, forwardAuth };
