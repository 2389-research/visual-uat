// ABOUTME: Client-side JavaScript for demo app interactions
// ABOUTME: Handles view switching and form submission

// View switching
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Remove active class from all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected view
  const selectedView = document.getElementById(`${viewName}-view`);
  if (selectedView) {
    selectedView.classList.add('active');
  }

  // Activate corresponding nav button
  const selectedBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('active');
  }
}

// Form handling
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const resultDiv = document.getElementById('form-result');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        message: document.getElementById('message').value
      };

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
          resultDiv.textContent = data.message;
          resultDiv.className = 'form-result success';
          form.reset();
        }
      } catch (error) {
        resultDiv.textContent = 'Error submitting form. Please try again.';
        resultDiv.className = 'form-result error';
      }
    });
  }
});

// Expose showView globally for onclick handlers
window.showView = showView;
