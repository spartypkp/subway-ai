import { Pool } from 'pg';

// Create a new Pool instance
export const pool = new Pool({
	user: '',
	host: 'localhost',
	database: 'subwayai',
	password: '',
	port: 5432,
});

// Helper function for running queries
export async function query(text: string, params?: any[]) {
	const start = Date.now();
	const res = await pool.query(text, params);
	const duration = Date.now() - start;
	console.log('Executed query', { text, duration, rows: res.rowCount });
	return res;
} 