#!/usr/bin/env node

const path = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Load environment variables from .env.local
const envFile = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !match[1].startsWith('#')) {
      process.env[match[1]] = match[2].replace(/^['"](.*)['"]$/, '$1').trim();
    }
  });
  console.log('Loaded environment variables from .env.local');
}

// Make sure database URL is trimmed to avoid whitespace issues
const dbUrl = (process.env.DATABASE_URL || '').trim();
console.log(`Using database URL: ${dbUrl}`);

// Create connection pool directly in this script
const pool = new Pool({
  connectionString: dbUrl || 'postgresql://postgres:postgres@localhost:5432/subwayai',
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
});

// Create a db object with a query method - similar to our src/lib/db.ts
const db = {
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

// Helper to insert a message node
async function insertMessageNode(projectId, branchId, parentId, role, text, createdBy, position) {
  const nodeId = uuidv4();
  await db.query(
    `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      nodeId,
      projectId,
      branchId,
      parentId,
      '',
      'message',
      JSON.stringify({ 
        role: role, 
        text: text 
      }),
      createdBy,
      new Date(Date.now() - (100 - position) * 60000), // Stagger the timestamps more significantly
      position
    ]
  );
  
  return nodeId;
}

// Helper to create a fork node (branch point)
async function createForkNode(projectId, branchId, parentId, reason, position) {
  const nodeId = uuidv4();
  await db.query(
    `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      nodeId,
      projectId,
      branchId,
      parentId,
      '',
      'fork',
      JSON.stringify({ reason: reason }),
      'system',
      new Date(Date.now() - (100 - position) * 60000),
      position
    ]
  );
  
  return nodeId;
}

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Clean up existing data first
    console.log('Cleaning up existing data...');
    try {
      // Delete timeline_nodes first due to foreign key constraints
      await db.query('DELETE FROM timeline_nodes');
      console.log('Deleted all timeline nodes');
      
      // Then delete projects
      await db.query('DELETE FROM projects');
      console.log('Deleted all projects');
    } catch (cleanupError) {
      console.error('Error during database cleanup:', cleanupError);
      throw cleanupError;
    }
    
    // Create a comprehensive AI Art project with multiple branches
    const projectId = uuidv4();
    const projectName = 'AI Art Project';
    
    console.log(`Creating project: ${projectName}`);
    await db.query(
      `INSERT INTO projects (id, name, description, created_at, updated_at, settings, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        projectId, 
        projectName, 
        'Exploring AI-generated art concepts and techniques', 
        new Date(), 
        new Date(),
        JSON.stringify({ theme: 'dark' }),
        JSON.stringify({ tools: ['Midjourney', 'DALL-E', 'Stable Diffusion'] })
      ]
    );
    
    // Create main branch
    const mainBranchId = uuidv4();
    
    // Create root node
    const rootNodeId = uuidv4();
    console.log('Creating root node');
    await db.query(
      `INSERT INTO timeline_nodes (id, project_id, branch_id, parent_id, expert_id, type, content, created_by, created_at, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        rootNodeId,
        projectId,
        mainBranchId,
        null,
        '',
        'root',
        JSON.stringify({ title: 'AI Art Discussion', context: {} }),
        'system',
        new Date(),
        0
      ]
    );
    
    // ===== MAIN CONVERSATION BRANCH =====
    console.log('Creating main conversation thread');
    
    // Message 1: Welcome message
    const msg1 = await insertMessageNode(
      projectId, 
      mainBranchId, 
      rootNodeId, 
      'assistant', 
      'Welcome to your AI Art project! I\'m here to help you explore the fascinating world of AI-generated art. What aspects are you most interested in learning about?',
      'ai',
      1
    );
    
    // Message 2: User response
    const msg2 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg1,
      'user',
      'I\'m interested in learning about different AI art models. What are the main ones I should know about?',
      'user',
      2
    );
    
    // Message 3: AI response about models
    const msg3 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg2,
      'assistant',
      'Great question! There are several major AI art models that have gained prominence. Here are the main ones you should know about:\n\n**1. DALL-E 2 & DALL-E 3 (OpenAI)**\n- Text-to-image generation with remarkable understanding of concepts\n- Excellent at following complex prompts and creating coherent scenes\n- DALL-E 3 offers significantly improved image quality and prompt following\n\n**2. Midjourney**\n- Known for its distinctive aesthetic and artistic quality\n- Particularly strong at creating atmospheric, painterly images\n- Has evolved through multiple versions with increasing photorealism\n\n**3. Stable Diffusion (Stability AI)**\n- Open-source model that can be run locally on consumer hardware\n- Highly customizable with a large community creating specialized versions\n- Popular for fine-tuning and creating custom models\n\n**4. Google\'s Imagen & Parti**\n- Research models with strong text understanding capabilities\n- Parti uses a sequence-to-sequence approach for high fidelity\n\n**5. Adobe Firefly**\n- Designed specifically for commercial use with licensed training data\n- Integrated into Adobe\'s creative suite\n- Focus on being "safe for commercial use"\n\nEach model has its own strengths and aesthetic tendencies. Would you like me to go deeper into any particular one?',
      'ai',
      3
    );
    
    // Message 4: User asks about Stable Diffusion
    const msg4 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg3,
      'user',
      'I\'m particularly interested in Stable Diffusion since it\'s open source. How does it work and what makes it special?',
      'user',
      4
    );
    
    // Message 5: AI explains Stable Diffusion
    const msg5 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg4,
      'assistant',
      'Stable Diffusion is indeed fascinating, especially because of its open-source nature! Here\'s what makes it special and how it works:\n\n**How Stable Diffusion Works:**\n\n1. **Latent Diffusion Architecture**\n   - Unlike some other models, Stable Diffusion operates in a compressed "latent space" rather than pixel space\n   - This makes it much more computationally efficient and able to run on consumer GPUs\n   - The process involves compressing images, adding noise, then gradually removing noise while following text guidance\n\n2. **Technical Process:**\n   - Starts with random noise in the latent space\n   - Gradually denoises the image in steps (typically 20-50 steps)\n   - Uses a text encoder (CLIP) to guide the denoising process toward matching your prompt\n   - Finally decodes the latent representation back into a pixel image\n\n**What Makes Stable Diffusion Special:**\n\n1. **Open Source & Accessibility**\n   - The code and weights are publicly available, allowing researchers and developers to inspect and modify it\n   - Can run on consumer hardware (8GB+ VRAM GPU) unlike many AI models that require data centers\n   - Has spawned an entire ecosystem of derivatives and specialized versions\n\n2. **Community & Customization**\n   - Massive community creating custom models fine-tuned for specific styles or domains\n   - "Checkpoints" and "LoRAs" allow for specialized versions (anime style, photorealism, etc.)\n   - Extensions and GUIs like Automatic1111 make it accessible to non-technical users\n\n3. **Technical Innovations**\n   - Introduced concepts like textual inversion, ControlNet, and img2img\n   - Allows for precise control over image generation through techniques like inpainting and outpainting\n   - Supports concepts like negative prompts to specify what you don\'t want in the image\n\nWould you like me to explain how to get started with Stable Diffusion, or perhaps dive deeper into specific techniques like prompt engineering for it?',
      'ai',
      5
    );
    
    // Message 6: User asks about getting started
    const msg6 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg5,
      'user',
      'I\'d love to know how to get started with Stable Diffusion. What\'s the easiest way for a beginner?',
      'user',
      6
    );
    
    // Message 7: AI explains getting started (BRANCH POINT 1)
    const msg7 = await insertMessageNode(
      projectId,
      mainBranchId,
      msg6,
      'assistant',
      'Getting started with Stable Diffusion is easier than you might think! Here are the best options for beginners:\n\n**Option 1: Cloud-based Services (Easiest)**\n\n- **RunwayML**: A user-friendly web interface with a free tier\n- **Leonardo.ai**: Offers generous free credits and a simple interface\n- **Replicate.com**: Pay-as-you-go model with various Stable Diffusion versions\n- **DreamStudio** (by Stability AI): The official platform from Stable Diffusion\'s creators\n\nThese require no setup and let you start generating immediately.\n\n**Option 2: Local Installation (More Control)**\n\nIf you have a compatible GPU (NVIDIA with 8GB+ VRAM is ideal), you can run it locally:\n\n1. **Automatic1111 WebUI** (Most Popular):\n   ```bash\n   # Clone the repository\n   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git\n   cd stable-diffusion-webui\n   \n   # Run the WebUI (Windows)\n   webui-user.bat\n   \n   # Run the WebUI (Linux/Mac)\n   ./webui.sh\n   ```\n\n2. **ComfyUI** (More visual/node-based):\n   - Download from https://github.com/comfyanonymous/ComfyUI\n   - Offers a node-based interface for more visual workflow creation\n\n3. **InvokeAI** (User-friendly installer):\n   - Provides a more polished installation experience\n   - Has both command line and web interfaces\n\n**Option 3: Google Colab (Free GPU access)**\n\nIf you don\'t have a powerful GPU:\n- Use notebooks like [Stable Diffusion Web UI Colab](https://colab.research.google.com/github/camenduru/stable-diffusion-webui-colab/blob/main/stable/stable_diffusion_webui_colab.ipynb)\n- Provides free GPU access with some usage limitations\n\n**Basic Workflow to Get Started:**\n\n1. Choose a model/checkpoint (base Stable Diffusion 1.5 or 2.1 are good starting points)\n2. Enter a detailed prompt describing what you want to see\n3. Set parameters (steps: 20-30, CFG scale: 7-9 to start)\n4. Generate and iterate!\n\nWould you like specific recommendations for prompting techniques or particular models to try first?',
      'ai',
      7
    );
    
    // ===== BRANCH 1: CLOUD SERVICES =====
    const branch1Id = uuidv4();
    console.log('Creating branch 1: Cloud Services');
    
    // Create fork node for branch 1
    const fork1 = await createForkNode(
      projectId,
      branch1Id,
      msg7, // Branching from message 7
      'Exploring cloud services for Stable Diffusion',
      0
    );
    
    // Branch 1, Message 1: User asks about cloud services
    const b1msg1 = await insertMessageNode(
      projectId,
      branch1Id,
      fork1,
      'user',
      'I think I\'ll start with a cloud service since I don\'t have a powerful GPU. Which one would you recommend for a complete beginner, and what are the costs like?',
      'user',
      1
    );
    
    // Branch 1, Message 2: AI recommends cloud services
    const b1msg2 = await insertMessageNode(
      projectId,
      branch1Id,
      b1msg1,
      'assistant',
      'Starting with a cloud service is a great choice for beginners! Here\'s a breakdown of the top options with their costs and beginner-friendliness:\n\n**1. Leonardo.ai** - ⭐ Best for Beginners\n- **Free Tier**: 150+ generations per day (refreshed daily)\n- **Paid Plans**: Starting at $10/month for more generations and features\n- **Beginner-Friendly Features**:\n  - Very intuitive interface\n  - Built-in prompt suggestions\n  - Community showcase for inspiration\n  - Easy model switching\n  - Image editing and variations\n\n**2. RunwayML**\n- **Free Tier**: Limited generations with watermarks\n- **Paid Plans**: Starting at $12/month\n- **Highlights**:\n  - Clean, professional interface\n  - Additional AI tools beyond image generation\n  - Video generation features\n\n**3. DreamStudio** (by Stability AI)\n- **Pricing**: Pay-as-you-go credits ($10 free credits to start)\n- **Cost**: ~$0.02-0.10 per image depending on settings\n- **Highlights**:\n  - Official platform from Stable Diffusion creators\n  - Access to latest models\n  - Simple, focused interface\n\n**4. Replicate.com**\n- **Pricing**: Pay-as-you-go, no subscription needed\n- **Cost**: ~$0.05-0.10 per generation\n- **Highlights**:\n  - Access to many different model versions\n  - API access if you want to build applications\n  - Simple interface\n\n**For a complete beginner, I recommend starting with Leonardo.ai because:**\n- The generous free tier lets you experiment extensively\n- The interface is very intuitive with helpful guidance\n- It has a community feature to see what others are creating\n- You can easily try different models and styles\n- The prompt guidance helps you learn effective prompting\n\n**Getting Started with Leonardo.ai:**\n1. Create a free account at leonardo.ai\n2. Select a model (SD XL is a good starting point)\n3. Enter your prompt (they provide helpful suggestions)\n4. Adjust basic settings like aspect ratio\n5. Generate and experiment!\n\nWould you like some effective prompt examples to try on Leonardo.ai to get started?',
      'ai',
      2
    );
    
    // Branch 1, Message 3: User asks for prompt examples
    const b1msg3 = await insertMessageNode(
      projectId,
      branch1Id,
      b1msg2,
      'user',
      'Yes, I\'d love some prompt examples to try! Also, how do I make sure I\'m creating original art and not just copying existing styles?',
      'user',
      3
    );
    
    // Branch 1, Message 4: AI provides prompt examples
    const b1msg4 = await insertMessageNode(
      projectId,
      branch1Id,
      b1msg3,
      'assistant',
      'Here are some effective prompt examples to try on Leonardo.ai, along with tips for creating original art!\n\n**Starter Prompts to Try:**\n\n1. **Landscape Scene**\n   ```\n   A serene mountain lake at sunset, majestic peaks reflected in crystal clear water, golden hour lighting, wispy clouds, photorealistic, 8k, detailed vegetation\n   ```\n\n2. **Character Design**\n   ```\n   Portrait of a futuristic cyberpunk detective, neon lighting, cybernetic implants, intense expression, highly detailed, studio lighting, professional photography\n   ```\n\n3. **Abstract Concept**\n   ```\n   Visual representation of human creativity, flowing colors, dynamic composition, surreal elements, digital art, trending on ArtStation\n   ```\n\n4. **Stylized Scene**\n   ```\n   Cozy bookstore interior in the style of Studio Ghibli, warm lighting, magical atmosphere, detailed books, plants, and wooden furniture, soft colors\n   ```\n\n5. **Product Visualization**\n   ```\n   Sleek futuristic smartphone design, floating in studio environment, minimalist, product photography, soft shadows, clean background, high-end advertising style\n   ```\n\n**Tips for Creating Original Art:**\n\n1. **Combine Unexpected Elements**\n   - Mix different themes, time periods, or styles\n   - Example: "Victorian-era robot gardener tending to mechanical plants"\n\n2. **Create Your Own Conceptual Worlds**\n   - Develop unique settings with their own rules and aesthetics\n   - Example: "Civilization living inside giant floating crystals, bioluminescent architecture"\n\n3. **Avoid Direct Artist References**\n   - Instead of "in the style of [famous artist]," describe the qualities you like\n   - Example: Use "impressionistic brushwork with vibrant complementary colors" rather than "like Van Gogh"\n\n4. **Use Descriptive Techniques Rather Than Names**\n   - Focus on techniques, materials, and qualities\n   - Example: "Bold linework, watercolor textures, dynamic composition" instead of specific artist names\n\n5. **Develop Personal Prompt Patterns**\n   - Create your own "prompt formula" that produces a consistent personal style\n   - Experiment with consistent elements across different images\n\n6. **Iterate and Refine**\n   - Use the variation feature to explore alternatives\n   - Take elements you like and refine the prompt\n   - Save prompts that work well as a starting point\n\n7. **Negative Prompts for Originality**\n   - Use negative prompts to avoid common or derivative elements\n   - Example negative prompt: "derivative, common composition, standard, unoriginal"\n\n**Prompt Structure for Originality:**\n```\n[Subject] + [Action/Situation] + [Environment] + [Lighting] + [Composition] + [Mood/Atmosphere] + [Technical Details] + [Style Description]\n```\n\nRemember that AI art is a collaboration between you and the AI. Your unique combinations of concepts, descriptions, and iterations will lead to original creations that reflect your creative vision!\n\nWould you like me to help you craft a completely original prompt based on a concept you have in mind?',
      'ai',
      4
    );
    
    // ===== BRANCH 2: LOCAL INSTALLATION =====
    const branch2Id = uuidv4();
    console.log('Creating branch 2: Local Installation');
    
    // Create fork node for branch 2
    const fork2 = await createForkNode(
      projectId,
      branch2Id,
      msg7, // Branching from message 7
      'Setting up local Stable Diffusion installation',
      0
    );
    
    // Branch 2, Message 1: User asks about local installation
    const b2msg1 = await insertMessageNode(
      projectId,
      branch2Id,
      fork2,
      'user',
      'I actually have a gaming PC with an RTX 3080, so I think I could run Stable Diffusion locally. Could you walk me through setting up the Automatic1111 WebUI? I\'m on Windows.',
      'user',
      1
    );
    
    // Branch 2, Message 2: AI provides installation instructions
    const b2msg2 = await insertMessageNode(
      projectId,
      branch2Id,
      b2msg1,
      'assistant',
      'Great choice! With an RTX 3080 (10GB VRAM), you\'ll have an excellent experience running Stable Diffusion locally. Here\'s a detailed, step-by-step guide to setting up Automatic1111 WebUI on Windows:\n\n**Prerequisites:**\n\n1. **Install Python 3.10.x** (NOT 3.11+)\n   - Download from [Python.org](https://www.python.org/downloads/release/python-3106/)\n   - During installation, check "Add Python to PATH"\n\n2. **Install Git**\n   - Download from [git-scm.com](https://git-scm.com/download/win)\n   - Use default installation options\n\n**Installation Steps:**\n\n1. **Create a folder** where you want to install Stable Diffusion (avoid paths with spaces)\n   - Example: `C:\\StableDiffusion`\n\n2. **Open Command Prompt as Administrator**\n   - Search for "cmd" in Start menu\n   - Right-click and select "Run as administrator"\n\n3. **Navigate to your folder**\n   ```bash\n   cd C:\\StableDiffusion\n   ```\n\n4. **Clone the repository**\n   ```bash\n   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git\n   ```\n\n5. **Navigate to the webui folder**\n   ```bash\n   cd stable-diffusion-webui\n   ```\n\n6. **Run the WebUI**\n   ```bash\n   webui-user.bat\n   ```\n   - The first run will download necessary files and models\n   - This may take 10-15 minutes depending on your internet speed\n\n7. **Download a model checkpoint**\n   - The installer will pause and ask you to download a model\n   - Open a browser and go to [Hugging Face](https://huggingface.co/runwayml/stable-diffusion-v1-5/tree/main)\n   - Download `v1-5-pruned-emaonly.safetensors` (about 4GB)\n   - Place it in the `models/Stable-diffusion` folder in your installation\n   - Return to command prompt and press Enter to continue\n\n8. **Access the WebUI**\n   - Once installation completes, it will start a local server\n   - Open your browser and go to `http://127.0.0.1:7860`\n   - You should see the Automatic1111 interface\n\n**Optimizing for Your RTX 3080:**\n\nEdit the `webui-user.bat` file with Notepad and change the COMMANDLINE_ARGS line to:\n\n```\nset COMMANDLINE_ARGS=--xformers --medvram --no-half-vae\n```\n\nThis enables xformers optimization for better performance and memory usage.\n\n**Essential Extensions to Install:**\n\nIn the WebUI, go to the "Extensions" tab, then "Available" and install:\n\n1. **ControlNet** - For precise control over image generation\n2. **Additional Networks** - For using LoRAs (smaller style models)\n3. **Image Browser** - Better management of your generations\n\n**First Steps After Installation:**\n\n1. Go to the txt2img tab\n2. Enter a prompt like: `a beautiful landscape, mountains, lake, sunset, photorealistic, detailed, 8k`\n3. Set Width and Height to 512 x 512\n4. Set Sampling Steps to 20\n5. Set Sampling Method to DPM++ 2M Karras\n6. Set CFG Scale to 7\n7. Click Generate\n\nWould you like me to explain how to install additional models or how to use some of the more advanced features once you have it set up?',
      'ai',
      2
    );
    
    // Branch 2, Message 3: User asks about additional models
    const b2msg3 = await insertMessageNode(
      projectId,
      branch2Id,
      b2msg2,
      'user',
      'Thanks for the detailed instructions! I\'ll start setting it up. While I\'m doing that, could you explain what additional models I should consider downloading and how to install them?',
      'user',
      3
    );
    
    // Branch 2, Message 4: AI explains additional models
    const b2msg4 = await insertMessageNode(
      projectId,
      branch2Id,
      b2msg3,
      'assistant',
      'Happy to help with additional models! Here\'s a guide to the best models to consider and how to install them:\n\n**Types of Models to Know About:**\n\n1. **Base Models/Checkpoints** - The core AI models (largest files, 2-7GB)\n2. **LoRAs** - Style or concept adaptations (smaller, 50-300MB)\n3. **Embeddings/Textual Inversions** - Specific concepts or styles (tiny, <5MB)\n4. **VAEs** - Improve color reproduction and details (medium, ~200MB)\n\n**Recommended Base Models:**\n\n1. **Stable Diffusion 1.5** - The versatile standard model\n   - Already suggested in the setup (v1-5-pruned-emaonly.safetensors)\n\n2. **Realistic Vision V5.1** - Photorealistic results\n   - [Download Link](https://civitai.com/models/4201/realistic-vision-v51)\n\n3. **Dreamshaper 8** - Versatile with great creative results\n   - [Download Link](https://civitai.com/models/4384/dreamshaper)\n\n4. **SDXL Base 1.0** - Higher resolution, better composition (needs more VRAM)\n   - [Download Link](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)\n\n**How to Install Base Models:**\n\n1. Download the `.safetensors` file from the links above\n2. Place in `stable-diffusion-webui/models/Stable-diffusion/`\n3. Click the 🔄 refresh button next to the model dropdown in the UI\n4. Select the model from the dropdown menu\n\n**Recommended VAE:**\n\n- **SD VAE** - Improves colors and details for most models\n  - [Download Link](https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors)\n  - Place in `stable-diffusion-webui/models/VAE/`\n  - Enable in Settings → VAE tab or select from VAE dropdown\n\n**Recommended LoRAs:**\n\n1. **Detail Tweaker LoRA** - Enhances details\n   - [Download Link](https://civitai.com/models/58390/detail-tweaker-lora-lora)\n\n2. **LCM LoRA** - Speeds up generation dramatically\n   - [Download Link](https://civitai.com/models/195519/lcm-lora-weights-stable-diffusion-acceleration)\n\n3. **epiCRealism** - Adds photorealistic details\n   - [Download Link](https://civitai.com/models/25694/epicrealism)\n\n**How to Install LoRAs:**\n\n1. Download the `.safetensors` file\n2. Place in `stable-diffusion-webui/models/Lora/`\n3. Use in prompts with `<lora:filename:weight>`\n   - Example: `a beautiful landscape <lora:epiCRealism:0.6>`\n4. Or use the Additional Networks extension panel\n\n**Recommended Embeddings:**\n\n1. **Negative embeddings** - Helps avoid common issues\n   - [Download Link](https://civitai.com/models/4629/bad-hands-5)\n\n2. **Quality embeddings** - Enhances overall quality\n   - [Download Link](https://civitai.com/models/77173/juggernaut-aftermath)\n\n**How to Install Embeddings:**\n\n1. Download the `.pt` or `.safetensors` file\n2. Place in `stable-diffusion-webui/embeddings/`\n3. Use in prompts by name\n   - Example: `a portrait of a woman, (quality_artwork)`\n   - For negative embeddings: `a portrait of a woman, (bad_hands:0.8)`',
      'ai',
      4
    );
    
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  }
}

seedDatabase();