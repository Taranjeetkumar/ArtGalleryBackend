import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1";

// Generate image from text prompt using DALL-E
export const generateImage = async (
  prompt,
  size = "1024x1024",
  quality = "standard"
) => {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
      throw new Error("OpenAI API key not configured");
    }

    console.log("ggffdtrdr", OPENAI_API_KEY);
    const response = await axios.post(
      `${OPENAI_API_URL}/images/generations`,
      {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        quality: quality,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      imageUrl: response.data.data[0].url,
      revisedPrompt: response.data.data[0].revised_prompt,
    };
  } catch (error) {
    console.error(
      "AI Image Generation Error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

// Create variations of an existing image
export const createImageVariation = async (imageBase64) => {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
      throw new Error("OpenAI API key not configured");
    }

    // For DALL-E variations, we need to convert base64 to a file
    // This is a simplified version - in production, you'd handle this properly
    const response = await axios.post(
      `${OPENAI_API_URL}/images/variations`,
      {
        image: imageBase64,
        n: 1,
        size: "1024x1024",
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      imageUrl: response.data.data[0].url,
    };
  } catch (error) {
    console.error("AI Variation Error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

// Get AI suggestions for artwork improvements
export const getArtSuggestions = async (artworkDescription, style) => {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
      throw new Error("OpenAI API key not configured");
    }

    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert art advisor providing creative suggestions for digital artwork improvements.",
          },
          {
            role: "user",
            content: `Given an artwork described as "${artworkDescription}" with style "${style}", provide 5 specific creative suggestions for improvement. Keep each suggestion concise and actionable.`,
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      suggestions: response.data.choices[0].message.content,
    };
  } catch (error) {
    console.error(
      "AI Suggestions Error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

// Generate color palette from description
export const generateColorPalette = async (description) => {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
      return {
        success: true,
        palette: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"], // Fallback palette
      };
    }

    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a color theory expert. Return ONLY a JSON array of 5 hex color codes, nothing else.",
          },
          {
            role: "user",
            content: `Generate a cohesive 5-color palette for: "${description}". Return only the array like ["#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX", "#XXXXXX"]`,
          },
        ],
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paletteText = response.data.choices[0].message.content.trim();
    const palette = JSON.parse(paletteText);

    return {
      success: true,
      palette: palette,
    };
  } catch (error) {
    console.error(
      "Color Palette Error:",
      error.response?.data || error.message
    );
    // Return a nice fallback palette
    return {
      success: true,
      palette: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"],
    };
  }
};

export default {
  generateImage,
  createImageVariation,
  getArtSuggestions,
  generateColorPalette,
};
