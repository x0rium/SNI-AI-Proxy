# 1. Use the official Node.js LTS Alpine image as a base
FROM node:lts-alpine

# 2. Create a non-root user and group for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 3. Set the working directory in the container
WORKDIR /app

# 4. Copy package definition and lock file
COPY package.json pnpm-lock.yaml ./

# 5. Install pnpm globally
RUN npm install -g pnpm

# 6. Install only production dependencies using pnpm
RUN pnpm install --prod

# 7. Copy the rest of the application code
COPY index.js logger.js config.yaml ./

# 8. Create the logs directory needed by the application
RUN mkdir logs

# 9. Change ownership of the application directory to the non-root user
# This ensures the user can write to the logs directory
RUN chown -R appuser:appgroup /app

# 10. Switch to the non-root user
USER appuser

# 11. Expose the port the application runs on
EXPOSE 443

# 12. Define the command to run the application
CMD ["node", "index.js"]