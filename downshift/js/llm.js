/**
 * LLM Integration Module
 * Handles API calls to LLM providers (OpenAI, Anthropic, etc.)
 * Generates personalized mobility routines based on user context
 */

const LLM = (() => {
  const PROVIDERS = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic'
  };

  const SYSTEM_PROMPT = `You are an expert Physical Therapist and mobility coach specializing in pre-sleep flexibility routines.

Your role is to generate personalized 15-minute mobility sequences based on the user's current body state and input.

PRINCIPLES:
- Focus on parasympathetic activation and tension release
- Prioritize areas marked as "tight" or "pain" in the body map
- Use gentle, floor-based movements suitable for pre-sleep
- Include breath cues and proprioceptive awareness
- Progressive relaxation from dynamic to static holds

OUTPUT FORMAT:
You must respond with valid JSON only, using this exact structure:
{
  "routine": [
    {
      "name": "Exercise Name",
      "duration": 60,
      "cues": ["Cue 1", "Cue 2", "Cue 3"],
      "avoid": "What to avoid",
      "pose": "brief description of body position for visualization"
    }
  ],
  "totalDuration": 900,
  "focus": "Brief summary of routine focus"
}

EXERCISE GUIDELINES:
- Duration in seconds (typical: 30-120 seconds per exercise)
- Cues should be concise, professional "physio-speak"
- Avoid gamification language - just the work
- Pose descriptions should be simple for stick figure rendering
- Total duration should match requested time (±30 seconds acceptable)

COMMON EXERCISES:
- Child's Pose, Cat-Cow, Thread the Needle, Supine Twist
- 90/90 Hip Stretch, Pigeon Pose, Frog Stretch
- Prone Scorpion, Lizard Pose, Seal Stretch
- Legs-Up-Wall, Reclined Butterfly, Happy Baby
- Neck Rolls, Shoulder Rolls, Wrist Circles

Remember: This is pre-sleep. End with the most relaxing position.`;

  /**
   * Generate routine using OpenAI
   */
  const generateRoutineOpenAI = async (apiKey, bodyState, userInput, duration, focus) => {
    const userPrompt = buildUserPrompt(bodyState, userInput, duration, focus);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    try {
      const routine = JSON.parse(content);
      return routine;
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse LLM response as JSON');
    }
  };

  /**
   * Generate routine using Anthropic Claude
   */
  const generateRoutineAnthropic = async (apiKey, bodyState, userInput, duration, focus) => {
    const userPrompt = buildUserPrompt(bodyState, userInput, duration, focus);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API request failed');
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON response
    try {
      const routine = JSON.parse(content);
      return routine;
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse LLM response as JSON');
    }
  };

  /**
   * Build user prompt from context
   */
  const buildUserPrompt = (bodyState, userInput, duration, focus) => {
    const tightAreas = bodyState.filter(s => s.status === 'tight').map(s => s.area);
    const painAreas = bodyState.filter(s => s.status === 'pain').map(s => s.area);

    let prompt = `Generate a ${duration}-minute mobility routine.\n\n`;

    prompt += `BODY STATE:\n`;
    if (tightAreas.length > 0) {
      prompt += `- Tight areas: ${tightAreas.join(', ')}\n`;
    }
    if (painAreas.length > 0) {
      prompt += `- Pain areas: ${painAreas.join(', ')}\n`;
    }
    if (tightAreas.length === 0 && painAreas.length === 0) {
      prompt += `- All areas normal (general maintenance)\n`;
    }

    prompt += `\nCURRENT STATUS:\n${userInput || 'No specific concerns'}\n\n`;

    prompt += `FOCUS: ${focus === 'sleep' ? 'Relaxation / Sleep preparation' : 'Recovery / Mobility'}\n\n`;

    prompt += `Please generate an appropriate routine in the JSON format specified.`;

    return prompt;
  };

  /**
   * Main function to generate routine
   */
  const generateRoutine = async (bodyState, userInput, duration, focus) => {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your LLM API key in the Check-In view.');
    }

    const provider = Storage.getLLMProvider();

    try {
      let routine;
      if (provider === PROVIDERS.OPENAI) {
        routine = await generateRoutineOpenAI(apiKey, bodyState, userInput, duration, focus);
      } else if (provider === PROVIDERS.ANTHROPIC) {
        routine = await generateRoutineAnthropic(apiKey, bodyState, userInput, duration, focus);
      } else {
        throw new Error(`Unknown LLM provider: ${provider}`);
      }

      // Validate routine structure
      if (!routine.routine || !Array.isArray(routine.routine)) {
        throw new Error('Invalid routine structure from LLM');
      }

      // Ensure all exercises have required fields
      routine.routine = routine.routine.map(exercise => ({
        name: exercise.name || 'Unnamed Exercise',
        duration: exercise.duration || 60,
        cues: Array.isArray(exercise.cues) ? exercise.cues : [],
        avoid: exercise.avoid || 'No specific cautions',
        pose: exercise.pose || 'seated position'
      }));

      return routine;
    } catch (error) {
      console.error('LLM generation error:', error);
      throw error;
    }
  };

  /**
   * Get fallback routine (in case of API failure)
   */
  const getFallbackRoutine = (duration) => {
    const exercisesPerMinute = 4; // ~15 seconds per exercise
    const totalExercises = Math.floor(duration / 15) * exercisesPerMinute;
    const exerciseDuration = Math.floor((duration * 60) / totalExercises);

    const exercises = [
      {
        name: "Child's Pose",
        duration: exerciseDuration * 1.5,
        cues: [
          "Knees wide, big toes together",
          "Sink hips back towards heels",
          "Extend arms forward, forehead to floor"
        ],
        avoid: "Don't force hips if knee discomfort",
        pose: "kneeling forward fold"
      },
      {
        name: "Cat-Cow",
        duration: exerciseDuration,
        cues: [
          "Hands under shoulders, knees under hips",
          "Inhale: drop belly, lift gaze",
          "Exhale: round spine, tuck chin"
        ],
        avoid: "Don't hyperextend neck",
        pose: "quadruped spine wave"
      },
      {
        name: "Thread the Needle",
        duration: exerciseDuration,
        cues: [
          "From table, slide right arm under left",
          "Right shoulder to floor",
          "Gaze follows the ceiling arm"
        ],
        avoid: "Don't collapse into bottom shoulder",
        pose: "side-lying spinal twist"
      },
      {
        name: "Supine Twist",
        duration: exerciseDuration,
        cues: [
          "Knees to chest, drop both legs right",
          "Left shoulder stays grounded",
          "Head turns left"
        ],
        avoid: "Don't force knee to floor",
        pose: "supine spinal twist"
      },
      {
        name: "Happy Baby",
        duration: exerciseDuration,
        cues: [
          "Grab outside edges of feet",
          "Knees track towards armpits",
          "Low back stays grounded"
        ],
        avoid: "Don't let tailbone lift",
        pose: "supine hip stretch"
      },
      {
        name: "Legs-Up-Wall",
        duration: exerciseDuration * 2,
        cues: [
          "Sit sideways to wall, swing legs up",
          "Hips against or slightly away from wall",
          "Arms wide or on belly"
        ],
        avoid: "Don't stay if tingling occurs",
        pose: "inverted legs position"
      }
    ];

    return {
      routine: exercises.slice(0, totalExercises),
      totalDuration: duration * 60,
      focus: "General relaxation and mobility"
    };
  };

  // Public API
  return {
    generateRoutine,
    getFallbackRoutine,
    PROVIDERS
  };
})();
