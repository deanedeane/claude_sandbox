/**
 * Assessment Module
 * Guided flexibility assessment with LLM-powered test generation and scoring
 */

const Assessment = (() => {
  let tests = [];
  let currentTestIndex = 0;
  let assessmentResults = [];
  let recognition = null;

  // DOM elements
  let startAssessmentBtn;
  let beginAssessmentBtn;
  let voiceTestBtn;
  let scoreTestBtn;
  let nextTestBtn;
  let saveAssessmentBtn;
  let testResponse;

  // Screens
  let introScreen;
  let testScreen;
  let resultsScreen;
  let loadingScreen;

  /**
   * Initialize assessment module
   */
  const init = () => {
    // Buttons
    startAssessmentBtn = document.getElementById('start-assessment-btn');
    beginAssessmentBtn = document.getElementById('begin-assessment-btn');
    voiceTestBtn = document.getElementById('voice-test-btn');
    scoreTestBtn = document.getElementById('score-test-btn');
    nextTestBtn = document.getElementById('next-test-btn');
    saveAssessmentBtn = document.getElementById('save-assessment-btn');

    // Input
    testResponse = document.getElementById('test-response');

    // Screens
    introScreen = document.getElementById('assessment-intro');
    testScreen = document.getElementById('assessment-test');
    resultsScreen = document.getElementById('assessment-results');
    loadingScreen = document.getElementById('assessment-loading');

    // Event listeners
    startAssessmentBtn.addEventListener('click', handleStartAssessment);
    beginAssessmentBtn.addEventListener('click', handleBeginAssessment);
    scoreTestBtn.addEventListener('click', handleScoreTest);
    nextTestBtn.addEventListener('click', handleNextTest);
    saveAssessmentBtn.addEventListener('click', handleSaveAssessment);
    voiceTestBtn.addEventListener('click', toggleVoiceInput);

    // Initialize speech recognition
    initSpeechRecognition();
  };

  /**
   * Initialize speech recognition
   */
  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        testResponse.value += (testResponse.value ? ' ' : '') + transcript;
        stopVoiceInput();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceInput();
      };

      recognition.onend = () => {
        stopVoiceInput();
      };
    } else {
      voiceTestBtn.style.display = 'none';
    }
  };

  /**
   * Toggle voice input
   */
  const toggleVoiceInput = () => {
    if (!recognition) return;

    if (voiceTestBtn.classList.contains('listening')) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  /**
   * Start voice input
   */
  const startVoiceInput = () => {
    try {
      recognition.start();
      voiceTestBtn.classList.add('listening');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  };

  /**
   * Stop voice input
   */
  const stopVoiceInput = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        // Ignore
      }
    }
    voiceTestBtn.classList.remove('listening');
  };

  /**
   * Handle start assessment button
   */
  const handleStartAssessment = () => {
    Navigation.showView('assessment');
    showScreen('intro');
  };

  /**
   * Handle begin assessment button
   */
  const handleBeginAssessment = async () => {
    showScreen('loading');
    document.getElementById('loading-message').textContent = 'Generating your personalized assessment...';

    try {
      // Generate tests using LLM
      tests = await generateTests();
      currentTestIndex = 0;
      assessmentResults = [];

      // Start first test
      showScreen('test');
      displayTest(tests[currentTestIndex]);

    } catch (error) {
      console.error('Failed to generate tests:', error);
      alert('Failed to generate assessment tests. Please check your API key and try again.');
      showScreen('intro');
    }
  };

  /**
   * Generate assessment tests using LLM
   */
  const generateTests = async () => {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const provider = Storage.getLLMProvider();

    const systemPrompt = `You are an expert Physical Therapist creating a flexibility assessment for a 34-year-old athlete.

Generate 6 movement tests covering different body areas. For each test, provide:
1. Category (e.g., "Lower Body", "Upper Body", "Spine", "Hips")
2. Test name (e.g., "Forward Fold Test")
3. Clear instructions on how to perform the test
4. What to look for / what indicates good vs poor flexibility

Respond with JSON only:
{
  "tests": [
    {
      "category": "Lower Body",
      "name": "Forward Fold Test",
      "instructions": "Stand with feet hip-width apart. Slowly bend forward from your hips, letting your arms hang down. Try to reach as far as you can without bouncing. Hold for 3 breaths.",
      "scoring_guide": "10 = palms flat on floor, 7-9 = fingers touch floor, 4-6 = touch shins/ankles, 1-3 = can only reach knees, 0 = significant pain or restriction"
    }
  ]
}`;

    const userPrompt = `Generate 6 comprehensive flexibility tests covering: Lower Body, Upper Body, Spine/Back, Hips, Shoulders, and Overall Balance. Make them practical for someone to do at home.`;

    let response;
    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7
        })
      });
    } else if (provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });
    }

    if (!response.ok) {
      throw new Error('LLM API request failed');
    }

    const data = await response.json();
    const content = provider === 'openai' ? data.choices[0].message.content : data.content[0].text;

    // Parse JSON
    try {
      const parsed = JSON.parse(content);
      return parsed.tests;
    } catch (error) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.tests;
      }
      throw new Error('Failed to parse LLM response');
    }
  };

  /**
   * Display a test
   */
  const displayTest = (test) => {
    document.getElementById('test-progress').textContent = `Test ${currentTestIndex + 1} of ${tests.length}`;
    document.getElementById('test-category').textContent = test.category;
    document.getElementById('test-name').textContent = test.name;
    document.getElementById('test-instructions').innerHTML = `<p style="color: var(--text-secondary); line-height: 1.8; font-size: 1.1rem; margin-bottom: 2rem;">${test.instructions}</p><p style="color: var(--text-tertiary); font-size: 0.95rem; font-style: italic;">${test.scoring_guide}</p>`;

    // Generate quick response buttons
    generateQuickResponses(test);

    // Reset input
    testResponse.value = '';
    document.getElementById('test-score-display').style.display = 'none';
  };

  /**
   * Generate quick response buttons based on test
   */
  const generateQuickResponses = (test) => {
    const quickResponsesDiv = document.getElementById('quick-responses');
    quickResponsesDiv.innerHTML = '';

    // Default responses that work for most tests
    const responses = [
      "Full range, no issues",
      "Slight tightness, can complete",
      "Moderate restriction, some discomfort",
      "Significant limitation, painful"
    ];

    responses.forEach((response, index) => {
      const btn = document.createElement('button');
      btn.className = 'quick-response-btn';
      btn.textContent = response;
      btn.dataset.response = response;

      btn.addEventListener('click', () => {
        // Deselect all
        document.querySelectorAll('.quick-response-btn').forEach(b => b.classList.remove('selected'));
        // Select this one
        btn.classList.add('selected');
        // Set as test response
        testResponse.value = response;
      });

      quickResponsesDiv.appendChild(btn);
    });
  };

  /**
   * Handle score test button
   */
  const handleScoreTest = async () => {
    const response = testResponse.value.trim();

    if (!response) {
      alert('Please describe what you experienced during the test.');
      return;
    }

    scoreTestBtn.disabled = true;
    scoreTestBtn.textContent = 'Scoring...';

    try {
      const result = await scoreTest(tests[currentTestIndex], response);

      // Display score
      document.getElementById('test-score-value').textContent = `${result.score}/10`;
      document.getElementById('test-feedback').textContent = result.feedback;
      document.getElementById('test-score-display').style.display = 'block';

      // Store result
      assessmentResults.push({
        ...tests[currentTestIndex],
        userResponse: response,
        score: result.score,
        feedback: result.feedback
      });

      scoreTestBtn.textContent = 'Score This Test';
      scoreTestBtn.disabled = false;

    } catch (error) {
      console.error('Scoring failed:', error);
      alert('Failed to score the test. Please try again.');
      scoreTestBtn.textContent = 'Score This Test';
      scoreTestBtn.disabled = false;
    }
  };

  /**
   * Score a test using LLM
   */
  const scoreTest = async (test, userResponse) => {
    const apiKey = Storage.getApiKey();
    const provider = Storage.getLLMProvider();

    const systemPrompt = `You are an expert Physical Therapist scoring a flexibility test.

Test: ${test.name}
Category: ${test.category}
Scoring Guide: ${test.scoring_guide}

Based on the user's description, assign a score from 0-10 and provide brief feedback (2-3 sentences).

Respond with JSON only:
{
  "score": 7,
  "feedback": "Good flexibility! You're able to reach past your knees, indicating decent hamstring length. Continue working on this movement to improve further."
}`;

    const userPrompt = `The user performed "${test.name}" and reported: "${userResponse}"\n\nScore this test.`;

    let response;
    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });
    } else {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });
    }

    if (!response.ok) {
      throw new Error('Scoring failed');
    }

    const data = await response.json();
    const content = provider === 'openai' ? data.choices[0].message.content : data.content[0].text;

    // Parse JSON
    try {
      return JSON.parse(content);
    } catch (error) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse score');
    }
  };

  /**
   * Handle next test button
   */
  const handleNextTest = () => {
    currentTestIndex++;

    if (currentTestIndex < tests.length) {
      displayTest(tests[currentTestIndex]);
    } else {
      showResults();
    }
  };

  /**
   * Show results screen
   */
  const showResults = () => {
    showScreen('results');

    // Calculate category averages
    const categoryScores = {};
    assessmentResults.forEach(result => {
      if (!categoryScores[result.category]) {
        categoryScores[result.category] = { total: 0, count: 0 };
      }
      categoryScores[result.category].total += result.score;
      categoryScores[result.category].count += 1;
    });

    // Build bar chart HTML
    const resultsChart = document.getElementById('results-chart');
    resultsChart.innerHTML = '';

    Object.keys(categoryScores).forEach(category => {
      const avg = categoryScores[category].total / categoryScores[category].count;
      const percentage = (avg / 10) * 100;

      const barDiv = document.createElement('div');
      barDiv.className = 'result-bar';
      barDiv.innerHTML = `
        <div class="result-bar-header">
          <span class="result-bar-label">${category}</span>
          <span class="result-bar-score">${avg.toFixed(1)}/10</span>
        </div>
        <div class="result-bar-track">
          <div class="result-bar-fill" style="width: ${percentage}%">
            <span>${Math.round(percentage)}%</span>
          </div>
        </div>
      `;
      resultsChart.appendChild(barDiv);
    });
  };

  /**
   * Handle save assessment button
   */
  const handleSaveAssessment = async () => {
    // Save assessment results
    await Storage.saveSession({
      type: 'assessment',
      results: assessmentResults,
      completedAt: Date.now()
    });

    // Update body map based on scores
    await updateBodyMapFromAssessment();

    // Navigate back to body map
    Navigation.showView('bodymap');
  };

  /**
   * Update body map based on assessment scores
   */
  const updateBodyMapFromAssessment = async () => {
    // Map assessment results to body areas
    const areaMapping = {
      'Lower Body': ['left-hamstring', 'right-hamstring', 'left-knee', 'right-knee', 'left-calf', 'right-calf', 'left-ankle', 'right-ankle'],
      'Upper Body': ['left-shoulder', 'right-shoulder', 'upper-back'],
      'Spine': ['upper-back', 'lower-back', 'neck'],
      'Hips': ['left-hip', 'right-hip'],
      'Shoulders': ['left-shoulder', 'right-shoulder']
    };

    // Update body states based on scores
    for (const result of assessmentResults) {
      const areas = areaMapping[result.category] || [];
      const status = result.score >= 7 ? 'normal' : result.score >= 4 ? 'tight' : 'pain';

      for (const area of areas) {
        await Storage.updateBodyState(area, status);
      }
    }

    // Reload body map
    await BodyMap.init();
  };

  /**
   * Show a specific screen
   */
  const showScreen = (screen) => {
    introScreen.style.display = 'none';
    testScreen.style.display = 'none';
    resultsScreen.style.display = 'none';
    loadingScreen.style.display = 'none';

    switch (screen) {
      case 'intro':
        introScreen.style.display = 'block';
        break;
      case 'test':
        testScreen.style.display = 'block';
        break;
      case 'results':
        resultsScreen.style.display = 'block';
        break;
      case 'loading':
        loadingScreen.style.display = 'block';
        break;
    }
  };

  // Public API
  return {
    init
  };
})();
