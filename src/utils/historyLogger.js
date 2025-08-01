/**
 * Utility for logging item and employee history events
 */
const db = require('../config/db');

/**
 * Log item history
 */
const logItemHistory = async (itemId, actionType, actionDetails, userId) => {
  try {
    await db.query(`
      INSERT INTO item_history (item_id, action_type, action_details, performed_by, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [itemId, actionType, JSON.stringify(actionDetails), userId]);

    console.log(`Item history logged: ${actionType} for item ${itemId}`);
  } catch (error) {
    console.error('Error logging item history:', error);
    throw error;
  }
};

/**
 * Log employee history
 */
async function logEmployeeHistory(employeeId, actionType, actionDetails, performedBy) {
  try {
    await db.query(`
      INSERT INTO employee_history (employee_id, action_type, action_details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [employeeId, actionType, JSON.stringify(actionDetails), performedBy]);

    console.log(`Employee history logged: ${actionType} for employee ${employeeId}`);
  } catch (error) {
    console.error('Error logging employee history:', error);
    throw error;
  }
}

/**
 * Get formatted item history
 */
async function getItemHistory(itemId) {
  try {
    const result = await db.query(`
      SELECT h.*, u.name as performed_by_name
      FROM item_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.item_id = $1
      ORDER BY h.created_at DESC
    `, [itemId]);

    return result.rows.map(row => ({
      ...row,
      action_details: typeof row.action_details === 'string'
        ? JSON.parse(row.action_details)
        : row.action_details
    }));
  } catch (error) {
    console.error('Error getting item history:', error);
    throw error;
  }
}

/**
 * Get formatted employee history with related items information and resolved foreign keys
 */
async function getEmployeeHistory(employeeId) {
  try {
    // Get employee history
    const employeeHistoryResult = await db.query(`
      SELECT eh.*, u.name as performed_by_name
      FROM employee_history eh
      LEFT JOIN users u ON eh.performed_by = u.id
      WHERE eh.employee_id = $1
      ORDER BY eh.created_at DESC
    `, [employeeId]);

    // Get item history related to this employee
    const itemHistoryResult = await db.query(`
      SELECT ih.*, u.name as performed_by_name, i.name as item_name, i.cep_brc
      FROM item_history ih
      LEFT JOIN users u ON ih.performed_by = u.id
      LEFT JOIN items i ON ih.item_id = i.id
      WHERE ih.action_details::jsonb ? 'employee_id'
      AND (ih.action_details::jsonb->>'employee_id')::integer = $1
      ORDER BY ih.created_at DESC
    `, [employeeId]);

    // Process employee history and resolve foreign keys
    const processedEmployeeHistory = await Promise.all(
      employeeHistoryResult.rows.map(async (row) => {
        const actionDetails = typeof row.action_details === 'string'
          ? JSON.parse(row.action_details)
          : row.action_details;

        // Resolve foreign key references to names
        const resolvedDetails = await resolveForeignKeys(actionDetails);

        return {
          ...row,
          history_type: 'employee',
          action_details: resolvedDetails
        };
      })
    );

    // Combine and sort all history entries
    const allHistory = [
      ...processedEmployeeHistory,
      ...itemHistoryResult.rows.map(row => ({
        ...row,
        history_type: 'item',
        action_details: typeof row.action_details === 'string'
          ? JSON.parse(row.action_details)
          : row.action_details
      }))
    ];

    // Sort by created_at descending
    allHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return allHistory;
  } catch (error) {
    console.error('Error getting employee history:', error);
    throw error;
  }
}

/**
 * Resolve foreign key IDs to human-readable names
 */
async function resolveForeignKeys(actionDetails) {
  if (!actionDetails || typeof actionDetails !== 'object') {
    return actionDetails;
  }

  const resolved = { ...actionDetails };

  try {
    // Resolve department_id to department name
    if (actionDetails.dept_id || actionDetails.department_id) {
      const deptId = actionDetails.dept_id || actionDetails.department_id;
      if (deptId && typeof deptId === 'object' && deptId.from !== undefined) {
        // Handle change tracking format { from: id, to: id }
        if (deptId.from) {
          const fromDept = await db.query('SELECT name FROM departments WHERE id = $1', [deptId.from]);
          resolved.department_change = {
            from: fromDept.rows[0]?.name || `Department ID: ${deptId.from}`,
            to: null
          };
        }
        if (deptId.to) {
          const toDept = await db.query('SELECT name FROM departments WHERE id = $1', [deptId.to]);
          resolved.department_change = {
            ...resolved.department_change,
            to: toDept.rows[0]?.name || `Department ID: ${deptId.to}`
          };
        }
        // Remove the original dept_id
        delete resolved.dept_id;
        delete resolved.department_id;
      } else if (typeof deptId === 'number' || typeof deptId === 'string') {
        // Handle single ID
        const dept = await db.query('SELECT name FROM departments WHERE id = $1', [deptId]);
        resolved.department_name = dept.rows[0]?.name || `Department ID: ${deptId}`;
        delete resolved.dept_id;
        delete resolved.department_id;
      }
    }

    // Resolve location_id to location name
    if (actionDetails.location_id) {
      const locationId = actionDetails.location_id;
      if (locationId && typeof locationId === 'object' && locationId.from !== undefined) {
        // Handle change tracking format
        if (locationId.from) {
          const fromLoc = await db.query('SELECT name FROM locations WHERE id = $1', [locationId.from]);
          resolved.location_change = {
            from: fromLoc.rows[0]?.name || `Location ID: ${locationId.from}`,
            to: null
          };
        }
        if (locationId.to) {
          const toLoc = await db.query('SELECT name FROM locations WHERE id = $1', [locationId.to]);
          resolved.location_change = {
            ...resolved.location_change,
            to: toLoc.rows[0]?.name || `Location ID: ${locationId.to}`
          };
        }
        delete resolved.location_id;
      } else if (typeof locationId === 'number' || typeof locationId === 'string') {
        const location = await db.query('SELECT name FROM locations WHERE id = $1', [locationId]);
        resolved.location_name = location.rows[0]?.name || `Location ID: ${locationId}`;
        delete resolved.location_id;
      }
    }

    // Handle nested changes object
    if (actionDetails.changes) {
      resolved.changes = await resolveForeignKeys(actionDetails.changes);
    }

  } catch (error) {
    console.error('Error resolving foreign keys:', error);
    // Return original details if resolution fails
    return actionDetails;
  }

  return resolved;
}

/**
 * Log software assignment/unassignment
 */
async function logSoftwareHistory(employeeId, actionType, softwareDetails, performedBy) {
  try {
    await logEmployeeHistory(employeeId, actionType, {
      software_changes: softwareDetails,
      timestamp: new Date().toISOString()
    }, performedBy);
  } catch (error) {
    console.error('Error logging software history:', error);
    throw error;
  }
}

/**
 * Log activity for general system actions
 */
async function logActivity(userId, action, entityType, entityId, details, ipAddress) {
  try {
    await db.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]);

    console.log(`Activity logged: ${action} on ${entityType} ${entityId}`);
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error for activity logging to prevent breaking main functionality
  }
}

/**
 * Get recent activities for dashboard or admin view
 * Includes moves/changes on items, employees, and software
 */
async function getRecentActivities(limit = 50) {
  try {
    // Get recent activity logs
    const activityLogs = await db.query(`
      SELECT 'activity' AS source, al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at, u.name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);

    // Get recent item history
    const itemHistory = await db.query(`
      SELECT 'item' AS source, ih.id, ih.action_type AS action, 'item' AS entity_type, ih.item_id AS entity_id,
            ih.action_details AS details, ih.created_at, u.name as user_name, i.name as item_name, i.cep_brc
      FROM item_history ih
      LEFT JOIN users u ON ih.performed_by = u.id
      LEFT JOIN items i ON ih.item_id = i.id
      ORDER BY ih.created_at DESC
      LIMIT $1
    `, [limit]);

    // Get recent employee history
    const employeeHistory = await db.query(`
      SELECT 'employee' AS source, eh.id, eh.action_type AS action, 'employee' AS entity_type, eh.employee_id AS entity_id, eh.action_details AS details, eh.created_at, u.name as user_name
      FROM employee_history eh
      LEFT JOIN users u ON eh.performed_by = u.id
      ORDER BY eh.created_at DESC
      LIMIT $1
    `, [limit]);

    // Combine all activities
    const allActivities = [
      ...activityLogs.rows,
      ...itemHistory.rows.map(row => {
        let details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
        // Ensure item name and cep_brc are present in details for item activities
        if (row.entity_type === 'item') {
          details = { ...details, name: row.item_name, cep_brc: row.cep_brc };
        }
        return { ...row, details };
      }),
      ...employeeHistory.rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }))
    ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);

    return allActivities;
  } catch (error) {
    console.error('Error getting recent activities:', error);
    throw error;
  }
}

/**
 * Clean old history entries (for maintenance)
 */
async function cleanOldHistory(daysToKeep = 365) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const itemHistoryResult = await db.query(`
      DELETE FROM item_history
      WHERE created_at < $1
    `, [cutoffDate]);

    const employeeHistoryResult = await db.query(`
      DELETE FROM employee_history
      WHERE created_at < $1
    `, [cutoffDate]);

    const activityResult = await db.query(`
      DELETE FROM activity_logs
      WHERE created_at < $1
    `, [cutoffDate]);

    console.log(`Cleaned old history: ${itemHistoryResult.rowCount} item entries, ${employeeHistoryResult.rowCount} employee entries, ${activityResult.rowCount} activity entries`);

    return {
      itemHistory: itemHistoryResult.rowCount,
      employeeHistory: employeeHistoryResult.rowCount,
      activities: activityResult.rowCount
    };
  } catch (error) {
    console.error('Error cleaning old history:', error);
    throw error;
  }
}

module.exports = {
  logItemHistory,
  logEmployeeHistory,
  getItemHistory,
  getEmployeeHistory,
  logSoftwareHistory,
  logActivity,
  getRecentActivities,
  cleanOldHistory
};
