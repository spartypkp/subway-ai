-- Subway AI Test Data Seeding Script
-- This script creates a test project with a main conversation branch and two branching points

-- Clear existing test data
DELETE FROM timeline_nodes WHERE project_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM projects WHERE id = '11111111-1111-1111-1111-111111111111';

-- Create test project
INSERT INTO projects (
  id, 
  name, 
  description, 
  created_at, 
  updated_at, 
  settings, 
  context, 
  metadata
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Subway Demo Project',
  'A demonstration project showing conversation branching in Subway AI',
  NOW(),
  NOW(),
  '{"theme": "blue", "preferredView": "subway"}',
  '{"system": "You are a helpful assistant that specializes in explaining complex topics."}',
  '{}'
);

-- Main branch (BRANCH ID: a0000000-0000-0000-0000-000000000000)
-- Root node
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0000-000000000000',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  NULL,                                    -- parent id (NULL for root)
  'root',                                  -- type
  NULL,                                    -- status
  '{"reason": "Starting main conversation"}', -- content
  'system',                                -- created by
  NOW(),                                   -- created at
  0,                                       -- position
  '{}'                                     -- metadata
);

-- Message 1 (User): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000001',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0000-000000000000',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "Can you explain how neural networks work?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '1 minute',             -- created at
  1,                                       -- position
  '{}'                                     -- metadata
);

-- Message 2 (Assistant): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000002',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000001',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "Neural networks are computational models inspired by the human brain. They consist of interconnected nodes (neurons) that process information. The basic structure includes an input layer, one or more hidden layers, and an output layer. Each connection between neurons has a weight that gets adjusted during training through a process called backpropagation. This allows the network to learn patterns from data and make predictions or classifications. Would you like me to explain any specific aspect of neural networks in more detail?"}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '2 minutes',            -- created at
  2,                                       -- position
  '{}'                                     -- metadata
);

-- Message 3 (User): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000003',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000002',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "Can you explain backpropagation in more detail?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '3 minutes',            -- created at
  3,                                       -- position
  '{}'                                     -- metadata
);

-- First branch point (BRANCH ID: a1111111-1111-1111-1111-111111111111)
-- This branches from Message 2 (Assistant's explanation of neural networks)

-- Message 4 (User): First branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b1111111-1111-1111-0001-000000000001',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a1111111-1111-1111-1111-111111111111',  -- branch id
  'b0000000-0000-0000-0001-000000000002',  -- parent id (points to Message 2)
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "What are some real-world applications of neural networks?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '2 minutes 30 seconds', -- created at (note: branching happens after Message 2)
  1,                                       -- position
  '{}'                                     -- metadata
);

-- Message 5 (Assistant): First branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b1111111-1111-1111-0001-000000000002',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a1111111-1111-1111-1111-111111111111',  -- branch id
  'b1111111-1111-1111-0001-000000000001',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "Neural networks have numerous real-world applications across many fields:\\n\\n1. **Computer Vision**: Image recognition, object detection, facial recognition, and self-driving cars\\n\\n2. **Natural Language Processing**: Language translation, sentiment analysis, chatbots, and voice assistants\\n\\n3. **Healthcare**: Disease diagnosis, medical image analysis, drug discovery, and patient outcome prediction\\n\\n4. **Finance**: Fraud detection, algorithmic trading, credit scoring, and risk assessment\\n\\n5. **Recommendation Systems**: Product recommendations on e-commerce sites, content suggestions on streaming platforms\\n\\n6. **Gaming**: AI opponents, procedural content generation, and player behavior analysis\\n\\n7. **Manufacturing**: Quality control, predictive maintenance, and process optimization\\n\\nThese applications leverage neural networks ability to recognize patterns in complex, high-dimensional data and make predictions or classifications based on those patterns."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '3 minutes 30 seconds', -- created at
  2,                                       -- position
  '{}'                                     -- metadata
);

-- Continue with the main branch
-- Message 6 (Assistant): Main branch (response to Message 3 about backpropagation)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000004',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000003',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "Backpropagation is the core algorithm used to train neural networks. Heres how it works:\\n\\n1. **Forward Pass**: Input data is fed through the network, layer by layer, until it produces an output.\\n\\n2. **Error Calculation**: The difference between the predicted output and the actual target value is measured using a loss function.\\n\\n3. **Backward Pass**: The error is propagated backward through the network, from output to input. During this process, the gradient of the error with respect to each weight is calculated.\\n\\n4. **Weight Update**: Each weight is adjusted in the direction that minimizes the error, using the calculated gradients and a learning rate parameter.\\n\\nMathematically, backpropagation uses the chain rule of calculus to efficiently compute how each weight contributes to the error. This allows the network to learn from its mistakes and gradually improve its predictions over many iterations.\\n\\nThe key insight of backpropagation is that it provides a way to determine how much each neuron in the network contributed to the error, even for neurons in hidden layers that aren''t directly connected to the output."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '4 minutes',            -- created at
  4,                                       -- position
  '{}'                                     -- metadata
);

-- Message 7 (User): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000005',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000004',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "What are some common activation functions used in neural networks?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '5 minutes',            -- created at
  5,                                       -- position
  '{}'                                     -- metadata
);

-- Message 8 (Assistant): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000006',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000005',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "Activation functions are crucial components in neural networks that introduce non-linearity, allowing the network to learn complex patterns. Here are some common activation functions:\\n\\n1. **Sigmoid**: Maps values to range (0,1). Historically popular but suffers from vanishing gradient problem. Formula: σ(x) = 1/(1+e^(-x))\\n\\n2. **Tanh (Hyperbolic Tangent)**: Maps values to range (-1,1). Similar to sigmoid but zero-centered. Formula: tanh(x) = (e^x - e^(-x))/(e^x + e^(-x))\\n\\n3. **ReLU (Rectified Linear Unit)**: Returns x if x > 0, else 0. Most popular for hidden layers due to computational efficiency and helping with vanishing gradient problem. Formula: f(x) = max(0, x)\\n\\n4. **Leaky ReLU**: Modification of ReLU that allows small negative values when x < 0. Formula: f(x) = x if x > 0, else αx (where α is a small constant like 0.01)\\n\\n5. **ELU (Exponential Linear Unit)**: Combines benefits of ReLU but smoothes the function near x = 0. Formula: f(x) = x if x > 0, else α(e^x - 1)\\n\\n6. **Softmax**: Used in output layer for multi-class classification. Converts outputs to probability distribution. Formula: σ(z)_i = e^(z_i)/Σ(e^(z_j))\\n\\n7. **SELU (Scaled Exponential Linear Unit)**: Self-normalizing properties that help maintain mean and variance of activations. Used in SNNs.\\n\\nThe choice of activation function significantly impacts how well and how quickly a neural network learns."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '6 minutes',            -- created at
  6,                                       -- position
  '{}'                                     -- metadata
);

-- Second branch point (BRANCH ID: a2222222-2222-2222-2222-222222222222)
-- This branches from Message 8 (Assistant's explanation of activation functions)

-- Message 9 (User): Second branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b2222222-2222-2222-0001-000000000001',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a2222222-2222-2222-2222-222222222222',  -- branch id
  'b0000000-0000-0000-0001-000000000006',  -- parent id (points to Message 8)
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "Why is ReLU so popular compared to sigmoid or tanh?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '6 minutes 30 seconds', -- created at (note: branching happens after Message 8)
  1,                                       -- position
  '{}'                                     -- metadata
);

-- Message 10 (Assistant): Second branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b2222222-2222-2222-0001-000000000002',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a2222222-2222-2222-2222-222222222222',  -- branch id
  'b2222222-2222-2222-0001-000000000001',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "ReLU (Rectified Linear Unit) has become the default activation function for many neural networks, especially in deep learning, for several important reasons:\\n\\n1. **Computational Efficiency**: ReLU is much simpler to compute than sigmoid or tanh. It''s just max(0,x), which is faster to calculate and requires less computational resources.\\n\\n2. **Sparsity**: ReLU naturally creates sparse activations (many neurons output 0), which is beneficial for model efficiency and can help prevent overfitting.\\n\\n3. **Solving the Vanishing Gradient Problem**: Sigmoid and tanh functions saturate, meaning their gradients become very small as inputs become very positive or very negative. This leads to the vanishing gradient problem where neurons in early layers learn very slowly. ReLU doesn''t saturate for positive values, allowing for much faster learning.\\n\\n4. **Linear Behavior**: For all positive values, ReLU is simply the identity function (f(x) = x), which preserves gradients without squashing them and helps maintain the error signal strength during backpropagation.\\n\\n5. **Empirical Success**: In practice, networks with ReLU often converge faster and perform better than those with sigmoid or tanh activations.\\n\\nHowever, ReLU does have limitations like the \"dying ReLU\" problem (neurons that always output 0), which is why variants like Leaky ReLU, ELU, and others have been developed to address this issue while maintaining ReLU''s advantages."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '7 minutes 30 seconds', -- created at
  2,                                       -- position
  '{}'                                     -- metadata
);

-- Message 11 (User): Second branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b2222222-2222-2222-0001-000000000003',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a2222222-2222-2222-2222-222222222222',  -- branch id
  'b2222222-2222-2222-0001-000000000002',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "What''s the \"dying ReLU\" problem you mentioned?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '8 minutes 30 seconds', -- created at
  3,                                       -- position
  '{}'                                     -- metadata
);

-- Message 12 (Assistant): Second branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b2222222-2222-2222-0001-000000000004',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a2222222-2222-2222-2222-222222222222',  -- branch id
  'b2222222-2222-2222-0001-000000000003',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "The \"dying ReLU\" problem refers to a phenomenon where neurons with ReLU activation functions can become permanently inactive during training, effectively \"dying.\"\\n\\nHere''s what happens:\\n\\n1. If a neuron''s weights get updated in such a way that it produces a negative output for all inputs in the dataset, the ReLU function will always output zero for that neuron.\\n\\n2. When the output is zero, the gradient flowing back through that neuron during backpropagation is also zero.\\n\\n3. With a zero gradient, the weights of that neuron won''t be updated in future training iterations.\\n\\n4. The neuron becomes permanently inactive or \"dead\" for all inputs, rendering it useless in the network.\\n\\nThis issue can significantly reduce a network''s capacity, as a substantial portion of neurons might stop contributing to the learning process. In extreme cases, large parts of the network can become non-functional.\\n\\nSolutions to the dying ReLU problem include:\\n\\n1. **Leaky ReLU**: Allows a small, non-zero gradient when the input is negative (f(x) = αx for x < 0, where α is typically 0.01).\\n\\n2. **Parametric ReLU (PReLU)**: Similar to Leaky ReLU, but the coefficient α is learned during training.\\n\\n3. **ELU (Exponential Linear Unit)**: Smoothly approaches a negative value as input becomes increasingly negative.\\n\\n4. **Careful initialization**: Proper weight initialization can reduce the likelihood of neurons dying.\\n\\n5. **Lower learning rates**: Excessive learning rates can cause weights to update too aggressively, potentially pushing neurons into the negative region.\\n\\nThese variants and techniques help maintain the benefits of ReLU while reducing the risk of neurons dying during training."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '9 minutes 30 seconds', -- created at
  4,                                       -- position
  '{}'                                     -- metadata
);

-- Continue with the main branch
-- Message 13 (User): Main branch (continuing from Message 8 about activation functions)
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000007',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000006',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "user", "content": "What are some techniques to prevent overfitting in neural networks?"}', -- content
  'user',                                  -- created by
  NOW() + INTERVAL '7 minutes',            -- created at
  7,                                       -- position
  '{}'                                     -- metadata
);

-- Message 14 (Assistant): Main branch
INSERT INTO timeline_nodes (
  id,
  project_id,
  branch_id,
  parent_id,
  type,
  status,
  content,
  created_by,
  created_at,
  position,
  metadata
) VALUES (
  'b0000000-0000-0000-0001-000000000008',  -- node id
  '11111111-1111-1111-1111-111111111111',  -- project id
  'a0000000-0000-0000-0000-000000000000',  -- branch id
  'b0000000-0000-0000-0001-000000000007',  -- parent id
  'message',                               -- type
  NULL,                                    -- status
  '{"role": "assistant", "content": "Preventing overfitting is crucial in neural networks to ensure good generalization to unseen data. Here are important techniques to combat overfitting:\\n\\n1. **Regularization**:\\n   - L1 Regularization: Adds the sum of absolute values of weights to the loss function, encouraging sparse weights\\n   - L2 Regularization: Adds the sum of squared weights to the loss function, preventing any weight from becoming too large\\n\\n2. **Dropout**: Randomly deactivates a percentage of neurons during training, forcing the network to learn redundant representations and preventing co-adaptation\\n\\n3. **Early Stopping**: Monitoring validation performance and stopping training when validation metrics begin to degrade\\n\\n4. **Data Augmentation**: Artificially expanding the training dataset by creating modified versions of existing data (rotations, flips, crops, color adjustments, etc.)\\n\\n5. **Batch Normalization**: Normalizing layer inputs for each mini-batch, which can have a regularizing effect and stabilize training\\n\\n6. **Reducing Network Complexity**:\\n   - Decreasing the number of layers or neurons\\n   - Using simpler architectures when appropriate\\n\\n7. **Transfer Learning**: Using pre-trained models and fine-tuning only the last few layers for your specific task\\n\\n8. **K-fold Cross-validation**: Training and evaluating on different subsets of data to ensure robust performance\\n\\n9. **Weight Decay**: Gradually reducing the magnitude of weights during training\\n\\n10. **Ensemble Methods**: Combining predictions from multiple models to reduce overfitting bias\\n\\nThe choice of which techniques to use depends on your specific dataset, model architecture, and the nature of the problem you''re solving. Often, a combination of these techniques yields the best results."}', -- content
  'assistant',                             -- created by
  NOW() + INTERVAL '8 minutes',            -- created at
  8,                                       -- position
  '{}'                                     -- metadata
);

-- Commit the data
COMMIT; 