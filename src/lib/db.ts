import { Pool } from 'pg';

// Create a Pool instance using environment variables
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: process.env.NODE_ENV === 'production' 
		? { rejectUnauthorized: false }
		: false
});

// Create a db object with a query method
export const db = {
	/**
	 * Execute a SQL query with optional parameters
	 * @param text SQL query text
	 * @param params Array of parameters to pass to the query
	 * @returns Query result
	 */
	async query(text: string, params?: any[]) {
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
	},
	
	/**
	 * Get a client from the pool
	 * @returns A client from the pool
	 */
	async getClient() {
		const client = await pool.connect();
		return client;
	}
};

// Maintain backward compatibility with existing code
export async function query(text: string, params?: any[]) {
	return db.query(text, params);
}

export { pool }; 